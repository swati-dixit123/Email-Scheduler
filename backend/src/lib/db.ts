import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id          UUID PRIMARY KEY,
      sender      TEXT NOT NULL,
      recipient   TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      send_at     TIMESTAMPTZ NOT NULL,
      status      TEXT NOT NULL DEFAULT 'scheduled',
      attempts    INT NOT NULL DEFAULT 0,
      sent_at     TIMESTAMPTZ,
      preview_url TEXT,
      message_id  TEXT,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS emails_status_send_at_idx ON emails (status, send_at);
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE emails ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS emails_user_idx ON emails (user_id);
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );
  `);
}
