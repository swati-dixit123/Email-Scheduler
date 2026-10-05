import { FormEvent, useState } from "react";
import { api } from "../api";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const field =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-mute/60 focus:border-sea";

export default function ScheduleForm({ onCreated }: { onCreated: () => void }) {
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 2 * 60_000)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.create({
        to,
        from: from || undefined,
        subject,
        body,
        sendAt: new Date(when).toISOString(),
      });
      setMsg({ ok: true, text: "Scheduled. It will send at the time you picked." });
      setTo(""); setSubject(""); setBody("");
      setWhen(toLocalInput(new Date(Date.now() + 2 * 60_000)));
      onCreated();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="to" className="mb-1 block text-sm font-medium">To</label>
        <input id="to" type="email" required value={to} onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com" className={field} />
      </div>
      <div>
        <label htmlFor="from" className="mb-1 block text-sm font-medium">
          From <span className="font-normal text-mute">(optional, defaults to your Ethereal account)</span>
        </label>
        <input id="from" type="email" value={from} onChange={(e) => setFrom(e.target.value)}
          placeholder="sender@example.com" className={field} />
      </div>
      <div>
        <label htmlFor="subject" className="mb-1 block text-sm font-medium">Subject</label>
        <input id="subject" required maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)}
          className={field} />
      </div>
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium">Message</label>
        <textarea id="body" required rows={6} value={body} onChange={(e) => setBody(e.target.value)}
          className={field} />
      </div>
      <div>
        <label htmlFor="when" className="mb-1 block text-sm font-medium">Send at</label>
        <input id="when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)}
          className={field} />
        <p className="mt-1 text-xs text-mute">
          Your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}). A past time sends right away.
        </p>
      </div>
      <button disabled={busy}
        className="w-full rounded-md bg-sea px-4 py-2.5 text-sm font-semibold text-white hover:bg-sea-dark disabled:opacity-60">
        {busy ? "Scheduling…" : "Schedule email"}
      </button>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-sea" : "text-red-700"}`}>{msg.text}</p>
      )}
    </form>
  );
}
