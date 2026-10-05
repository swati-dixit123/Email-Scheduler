import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const COOKIE_NAME = "es_token";
const maxAgeMs = config.jwtExpiresInDays * 24 * 60 * 60 * 1000;

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: `${config.jwtExpiresInDays}d` });
}

const cookieBase = {
  httpOnly: true, // JS in the page can't read it (protects against XSS token theft)
  sameSite: "lax" as const,
  secure: config.isProd,
  path: "/",
};

export function setAuthCookie(res: Response, userId: string) {
  res.cookie(COOKIE_NAME, signToken(userId), { ...cookieBase, maxAge: maxAgeMs });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieBase);
}

export function readUserId(req: Request): string | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = readUserId(req);
  if (!userId) return res.status(401).json({ error: "Not signed in" });
  res.locals.userId = userId;
  next();
}
