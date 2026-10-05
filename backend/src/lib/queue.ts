import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { pool } from "./db";

export const QUEUE_NAME = "email-send";

// BullMQ requires maxRetriesPerRequest: null for blocking connections.
export const makeConnection = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const queueConnection = makeConnection();

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: config.maxAttempts,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

/**
 * Add a delayed job. jobId === email id makes this idempotent:
 * BullMQ ignores an add() when a job with the same id already exists.
 */
export async function enqueueEmail(emailId: string, sendAt: Date) {
  const delay = Math.max(0, sendAt.getTime() - Date.now());
  await emailQueue.add("send", { emailId }, { jobId: emailId, delay });
}

/**
 * Self-healing on boot. Delayed jobs already survive restarts (they live in Redis),
 * but if Redis was wiped/flushed we rebuild jobs from the DB, the source of truth.
 */
export async function reconcileQueue() {
  const { rows } = await pool.query(
    `SELECT id, send_at FROM emails WHERE status IN ('scheduled','retrying','sending')`
  );
  let restored = 0;
  for (const r of rows) {
    const job = await emailQueue.getJob(r.id);
    if (!job) {
      await enqueueEmail(r.id, new Date(r.send_at));
      restored++;
    }
  }
  console.log(`[reconcile] ${rows.length} pending emails in DB, ${restored} re-enqueued`);
}
