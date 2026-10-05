import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { config } from "./config";
import { migrate, pool } from "./lib/db";
import { initMailer } from "./lib/mailer";
import { emailQueue, queueConnection, reconcileQueue } from "./lib/queue";
import { startWorker } from "./lib/worker";
import { emailsRouter } from "./routes/emails";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./lib/auth";

async function main() {
  await migrate();
  await initMailer();
  await reconcileQueue();

  const worker = config.runWorker ? startWorker() : null;
  if (worker) console.log(`[worker] started (concurrency=${config.concurrency}, ${config.maxPerSecond}/s)`);

  let server: ReturnType<ReturnType<typeof express>["listen"]> | null = null;
  if (config.runApi) {
    const app = express();
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(cookieParser());
    app.use(express.json({ limit: "1mb" }));

    app.get("/api/health", async (_req, res) => {
      await pool.query("SELECT 1");
      res.json({ ok: true, queue: await emailQueue.getJobCounts() });
    });
    app.use("/api/auth", authRouter);
    app.use("/api/emails", requireAuth, emailsRouter);

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.flatten().fieldErrors });
      }
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    });

    server = app.listen(config.port, () => console.log(`[api] listening on :${config.port}`));
  }

  const shutdown = async (sig: string) => {
    console.log(`${sig} received, shutting down`);
    server?.close();
    await worker?.close(); // waits for in-flight jobs
    await emailQueue.close();
    await queueConnection.quit();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("Fatal startup error", e);
  process.exit(1);
});
