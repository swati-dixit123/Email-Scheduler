import dotenv from "dotenv";
dotenv.config({ override: true });

const num = (v: string | undefined, d: number) => (v && !isNaN(+v) ? +v : d);

export const config = {
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://scheduler:scheduler@localhost:5432/scheduler",
  redisUrl: (process.env.REDIS_URL ?? "redis://localhost:6379").replace(/^redis-cli\s+-u\s+/, "").trim(),
  concurrency: num(process.env.WORKER_CONCURRENCY, 5),
  maxPerSecond: num(process.env.WORKER_MAX_PER_SECOND, 5),
  maxPerSenderPerHour: num(process.env.MAX_EMAILS_PER_SENDER_PER_HOUR, 100),
  maxAttempts: num(process.env.MAX_ATTEMPTS, 3),
  etherealUser: process.env.ETHEREAL_USER || "",
  etherealPass: process.env.ETHEREAL_PASS || "",
  runApi: process.env.RUN_API !== "false",
  runWorker: process.env.RUN_WORKER !== "false",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  jwtExpiresInDays: num(process.env.JWT_EXPIRES_DAYS, 7),
  isProd: process.env.NODE_ENV === "production",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
