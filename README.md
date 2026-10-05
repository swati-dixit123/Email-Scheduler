# Email Scheduler (BullMQ + Redis + Postgres + Ethereal)

Schedule emails through an API or dashboard. Delivery uses BullMQ delayed jobs in Redis (no cron),
state lives in Postgres, and mail goes out through Ethereal's fake SMTP.

## Quick start

```bash
docker compose up -d                 # Postgres + Redis (Redis has AOF persistence on)

cd backend
cp .env.example .env                 # already provided as .env
npm install
npm run dev                          # API + worker on :4000

cd ../frontend
npm install
npm run dev                          # dashboard on http://localhost:5173
```

On first boot the backend creates an Ethereal account (needs internet) and stores it in the
`settings` table. Every sent email gets a **preview URL** shown in the dashboard.

## Authentication

Users sign up / sign in at `/register` and `/login`; `/logout` ends the session.
- Passwords are hashed with bcrypt; the session is a JWT in an **httpOnly cookie** (`es_token`, 7 days).
- Every `/api/emails*` route requires login and only returns/modifies the signed-in user's emails.
- Set `JWT_SECRET` in `backend/.env` (a random one was added) and use a new one in production.
- Existing emails created before auth have no owner, so they won't show up for any user.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` create account + sign in |
| POST | `/api/auth/login` | `{email, password}` |
| POST | `/api/auth/logout` | clear session cookie |
| GET | `/api/auth/me` | current user, or 401 |

## API

All endpoints below need a signed-in session.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/emails` | `{to, subject, body, sendAt (ISO-8601), from?}` schedule an email |
| GET | `/api/emails?status=scheduled\|sent\|failed\|cancelled\|all` | list |
| GET | `/api/emails/:id` | one email |
| DELETE | `/api/emails/:id` | cancel a pending email |
| GET | `/api/emails/stats` | counts per status |
| GET | `/api/health` | DB check + queue counts |

```bash
curl -X POST localhost:4000/api/emails -H 'Content-Type: application/json' -d '{
  "to":"someone@example.com","subject":"Hello","body":"Scheduled!",
  "sendAt":"'$(date -u -d '+1 minute' +%Y-%m-%dT%H:%M:%SZ)'"}'
```

## How it works

```
POST /emails -> INSERT row (status=scheduled) -> queue.add(jobId=emailId, delay=sendAt-now)
                                                         |
                                  Redis (persistent delayed set)
                                                         |
Worker picks job when due -> rate-limit check -> atomic claim -> Ethereal SMTP -> status=sent + preview URL
```

**Surviving restarts**
- Delayed jobs live in Redis (AOF enabled in `docker-compose.yml`), not in process memory. Restart the
  server and the pending jobs fire at their original times; nothing restarts from scratch.
- On boot, `reconcileQueue()` compares Postgres (source of truth) with the queue and re-enqueues any
  pending email missing a job, so even a flushed Redis loses nothing.
- Stalled jobs (worker crashed mid-send) are recovered by BullMQ; delivery is at-least-once.

**Idempotency**: `jobId` equals the email id, so duplicate enqueues are ignored. The worker only
processes rows in `scheduled/retrying/sending`, so cancelled or already-sent emails are skipped.

**Retries**: `MAX_ATTEMPTS` (default 3) with exponential backoff (5s, 10s…). Status shows
`retrying`, then `failed` with the error message.

**Rate limiting / concurrency**
- `WORKER_CONCURRENCY` parallel jobs, `WORKER_MAX_PER_SECOND` global throttle (BullMQ limiter).
- `MAX_EMAILS_PER_SENDER_PER_HOUR`: per-sender Redis counter. Over-limit jobs are moved to the next
  hour window (not dropped) and their `send_at` is updated.

## Test the restart guarantee
1. Schedule an email 2 minutes out.
2. Stop the backend (Ctrl+C) and start it again before the time passes (or even after it).
3. The email still sends, exactly once, and shows in **Sent**.

## Structure
```
backend/src
  index.ts          bootstrap, graceful shutdown
  config.ts         env config
  lib/db.ts         pg pool + migrations (auto-run on boot)
  lib/queue.ts      BullMQ queue, enqueue, boot reconcile
  lib/worker.ts     processor, retries, rate limits
  lib/mailer.ts     Ethereal/nodemailer
  lib/auth.ts       JWT cookie helpers + requireAuth middleware
  routes/auth.ts    register / login / logout / me
  routes/emails.ts  REST API (zod-validated, per-user)
frontend/src        React + Tailwind dashboard (polls every 5s)
  auth.tsx          AuthProvider / useAuth
  pages/            Login, Register, Logout, Dashboard
```
