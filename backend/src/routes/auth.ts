import { Router } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../lib/db";
import { clearAuthCookie, readUserId, setAuthCookie } from "../lib/auth";

export const authRouter = Router();

// Brute-force protection on credential endpoints.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email,
  // bcrypt only uses the first 72 bytes, so cap there.
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
});
const loginSchema = z.object({ email, password: z.string().min(1, "Password is required").max(72) });

const toUser = (r: any) => ({ id: r.id, name: r.name, email: r.email });

// A real hash to compare against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

authRouter.post("/register", limiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [randomUUID(), input.name, input.email, hash]
    );
    if (!rows[0]) return res.status(409).json({ error: "An account with this email already exists" });
    setAuthCookie(res, rows[0].id);
    res.status(201).json(toUser(rows[0]));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", limiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { rows } = await pool.query(`SELECT * FROM users WHERE email=$1`, [input.email]);
    const user = rows[0];
    const ok = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Incorrect email or password" });
    setAuthCookie(res, user.id);
    res.json(toUser(user));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Who am I? Returns 401 when not signed in.
authRouter.get("/me", async (req, res, next) => {
  try {
    const userId = readUserId(req);
    if (!userId) return res.status(401).json({ error: "Not signed in" });
    const { rows } = await pool.query(`SELECT * FROM users WHERE id=$1`, [userId]);
    if (!rows[0]) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Not signed in" });
    }
    res.json(toUser(rows[0]));
  } catch (e) {
    next(e);
  }
});
