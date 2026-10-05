import { useState } from "react";
import { api, Email, Group, Status } from "../api";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";

const badge: Record<Status, string> = {
  scheduled: "bg-sea-tint text-sea-dark",
  sending: "bg-amber-100 text-amber-800",
  retrying: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-700",
};

const emptyCopy: Record<Group, string> = {
  scheduled: "Nothing is waiting to send. Schedule an email from the form.",
  sent: "No emails have been sent yet. They appear here as soon as they go out.",
  failed: "No failures. Emails that fail all retries show up here with the reason.",
};

export default function EmailList({
  group, emails, loading, onChanged,
}: { group: Group; emails: Email[]; loading: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  if (loading && emails.length === 0) return <p className="py-10 text-sm text-mute">Loading…</p>;
  if (emails.length === 0) return <p className="py-10 text-sm text-mute">{emptyCopy[group]}</p>;

  const cancel = async (id: string) => {
    if (!confirm("Cancel this email? It won't be sent.")) return;
    try { await api.cancel(id); } catch (e) { alert((e as Error).message); }
    onChanged();
  };

  return (
    <ul className="divide-y divide-line border-y border-line">
      {emails.map((m) => {
        const expanded = open === m.id;
        return (
          <li key={m.id} className="py-3">
            <button onClick={() => setOpen(expanded ? null : m.id)} aria-expanded={expanded}
              className="flex w-full items-start gap-4 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.subject}</span>
                <span className="block truncate text-sm text-mute">To {m.to}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badge[m.status]}`}>
                  {m.status}
                </span>
                <span className="mt-1 block text-xs text-mute">
                  {group === "sent" ? `Sent ${fmt(m.sentAt)}` : `Send at ${fmt(m.sendAt)}`}
                </span>
              </span>
            </button>
            {expanded && (
              <div className="mt-3 space-y-3 rounded-md bg-white p-4 text-sm ring-1 ring-line">
                <p className="text-mute">From {m.from} · Attempts {m.attempts}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {m.error && <p className="text-red-700">Last error: {m.error}</p>}
                <div className="flex gap-4">
                  {m.previewUrl && (
                    <a href={m.previewUrl} target="_blank" rel="noreferrer"
                      className="font-medium text-sea underline">Open in Ethereal inbox</a>
                  )}
                  {(m.status === "scheduled" || m.status === "retrying") && (
                    <button onClick={() => cancel(m.id)} className="font-medium text-red-700 underline">
                      Cancel email
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
