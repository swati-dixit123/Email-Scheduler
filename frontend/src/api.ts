export type Status = "scheduled" | "sending" | "retrying" | "sent" | "failed" | "cancelled";

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sendAt: string;
  status: Status;
  attempts: number;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
  createdAt: string;
}

export type Group = "scheduled" | "sent" | "failed";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth/")) {
    // Session expired or cookie cleared: let AuthContext send the user to /login.
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!res.ok) {
    const details = data.details ? Object.entries(data.details).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
    throw new Error(details || data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export const api = {
  me: () => req<User>("/auth/me"),
  login: (b: { email: string; password: string }) =>
    req<User>("/auth/login", { method: "POST", body: JSON.stringify(b) }),
  register: (b: { name: string; email: string; password: string }) =>
    req<User>("/auth/register", { method: "POST", body: JSON.stringify(b) }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  list: (group: Group) => req<Email[]>(`/emails?status=${group}`),
  stats: () => req<Record<string, number>>("/emails/stats"),
  create: (b: { to: string; from?: string; subject: string; body: string; sendAt: string }) =>
    req<Email>("/emails", { method: "POST", body: JSON.stringify(b) }),
  cancel: (id: string) => req<Email>(`/emails/${id}`, { method: "DELETE" }),
};
