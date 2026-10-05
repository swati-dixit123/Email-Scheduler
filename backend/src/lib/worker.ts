import { Worker, DelayedError, Job } from "bullmq";
import { config } from "../config";
import { pool } from "./db";
import { makeConnection, QUEUE_NAME } from "./queue";
import { sendMail } from "./mailer";

const redis = makeConnection();

/** Returns ms until next hour boundary if sender is over its hourly cap, else 0. */
async function hourlyLimitDelay(sender: string): Promise<number> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `ratelimit:${sender}:${hour}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 7200);
  if (count > config.maxPerSenderPerHour) {
    await redis.decr(key); // this attempt doesn't consume a slot
    return (hour + 1) * 3_600_000 - Date.now() + 1000;
  }
  return 0;
}

async function processEmail(job: Job, token?: string) {
  const { emailId } = job.data as { emailId: string };

  const found = await pool.query(`SELECT * FROM emails WHERE id=$1`, [emailId]);
  const email = found.rows[0];
  if (!email) return; // deleted

  // Idempotency / cancellation guard
  if (!["scheduled", "retrying", "sending"].includes(email.status)) return;

  // Per-sender hourly rate limit: reschedule, never drop.
  const wait = await hourlyLimitDelay(email.sender);
  if (wait > 0) {
    const newTime = new Date(Date.now() + wait);
    await pool.query(`UPDATE emails SET send_at=$2, updated_at=now() WHERE id=$1`, [emailId, newTime]);
    await job.moveToDelayed(newTime.getTime(), token);
    console.log(`[worker] ${email.sender} over hourly cap; ${emailId} delayed to ${newTime.toISOString()}`);
    throw new DelayedError();
  }

  // Atomic claim
  const claim = await pool.query(
    `UPDATE emails SET status='sending', attempts=attempts+1, updated_at=now()
     WHERE id=$1 AND status IN ('scheduled','retrying','sending') RETURNING id`,
    [emailId]
  );
  if (claim.rowCount === 0) return;

  const res = await sendMail({
    from: email.sender,
    to: email.recipient,
    subject: email.subject,
    text: email.body,
  });

  await pool.query(
    `UPDATE emails SET status='sent', sent_at=now(), preview_url=$2, message_id=$3, error=NULL, updated_at=now()
     WHERE id=$1`,
    [emailId, res.previewUrl, res.messageId]
  );
  console.log(`[worker] sent ${emailId} -> ${email.recipient}  ${res.previewUrl ?? ""}`);
}

export function startWorker() {
  const worker = new Worker(QUEUE_NAME, processEmail, {
    connection: makeConnection(),
    concurrency: config.concurrency,
    limiter: { max: config.maxPerSecond, duration: 1000 },
  });

  worker.on("failed", async (job, err) => {
    if (!job || err instanceof DelayedError) return;
    const finalFailure = job.attemptsMade >= (job.opts.attempts ?? 1);
    const status = finalFailure ? "failed" : "retrying";
    await pool.query(`UPDATE emails SET status=$2, error=$3, updated_at=now() WHERE id=$1`, [
      job.data.emailId,
      status,
      err.message.slice(0, 500),
    ]);
    console.error(`[worker] ${job.data.emailId} ${status}: ${err.message}`);
  });

  worker.on("error", (e) => console.error("[worker] error", e.message));
  return worker;
}
