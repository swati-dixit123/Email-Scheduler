import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "../lib/db";
import { emailQueue, enqueueEmail } from "../lib/queue";
import { getDefaultSender } from "../lib/mailer";

export const emailsRouter = Router();

const createSchema = z.object({
  to: z.string().email(),
  from: z.string().email().optional(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(100_000),
  sendAt: z.string().datetime({ offset: true }), // ISO-8601
});

const toDto = (r: any) => ({
  id: r.id,
  from: r.sender,
  to: r.recipient,
  subject: r.subject,
  body: r.body,
  sendAt: r.send_at,
  status: r.status,
  attempts: r.attempts,
  sentAt: r.sent_at,
  previewUrl: r.preview_url,
  error: r.error,
  createdAt: r.created_at,
});

// Schedule a new email
emailsRouter.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const userId = res.locals.userId as string;
    const id = randomUUID();
    const sendAt = new Date(input.sendAt);
    const sender = input.from ?? getDefaultSender();

    // DB first (source of truth), then queue. If enqueue fails, the boot-time
    // reconcile recovers the row.
    const { rows } = await pool.query(
      `INSERT INTO emails (id, user_id, sender, recipient, subject, body, send_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, userId, sender, input.to, input.subject, input.body, sendAt]
    );
    await enqueueEmail(id, sendAt);
    res.status(201).json(toDto(rows[0]));
  } catch (e) {
    next(e);
  }
});

// List: ?status=scheduled|sent|failed|cancelled|all
emailsRouter.get("/", async (req, res, next) => {
  try {
    const group = String(req.query.status ?? "all");
    const map: Record<string, string[]> = {
      scheduled: ["scheduled", "sending", "retrying"],
      sent: ["sent"],
      failed: ["failed"],
      cancelled: ["cancelled"],
    };
    const statuses = map[group];
    const order = group === "sent" ? "sent_at DESC" : "send_at ASC";
    const userId = res.locals.userId as string;
    const { rows } = statuses
      ? await pool.query(
          `SELECT * FROM emails WHERE user_id = $1 AND status = ANY($2) ORDER BY ${order} LIMIT 500`,
          [userId, statuses]
        )
      : await pool.query(`SELECT * FROM emails WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]);
    res.json(rows.map(toDto));
  } catch (e) {
    next(e);
  }
});

emailsRouter.get("/stats", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT status, COUNT(*)::int AS n FROM emails WHERE user_id = $1 GROUP BY status`,
      [res.locals.userId]
    );
    res.json(Object.fromEntries(rows.map((r) => [r.status, r.n])));
  } catch (e) {
    next(e);
  }
});

emailsRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM emails WHERE id=$1 AND user_id=$2`, [req.params.id, res.locals.userId]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(toDto(rows[0]));
  } catch (e) {
    next(e);
  }
});

// Cancel a scheduled email
emailsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE emails SET status='cancelled', updated_at=now()
       WHERE id=$1 AND user_id=$2 AND status IN ('scheduled','retrying') RETURNING *`,
      [req.params.id, res.locals.userId]
    );
    if (!rows[0]) return res.status(409).json({ error: "Only scheduled emails can be cancelled" });
    try {
      await emailQueue.remove(req.params.id);
    } catch {
      /* job may be active; the worker re-checks status and skips cancelled rows */
    }
    res.json(toDto(rows[0]));
  } catch (e) {
    next(e);
  }
});
