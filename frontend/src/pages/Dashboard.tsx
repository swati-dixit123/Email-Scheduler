import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Email, Group } from "../api";
import { useAuth } from "../auth";
import ScheduleForm from "../components/ScheduleForm";
import EmailList from "../components/EmailList";

const tabs: { id: Group; label: string; keys: string[] }[] = [
  { id: "scheduled", label: "Scheduled", keys: ["scheduled", "sending", "retrying"] },
  { id: "sent", label: "Sent", keys: ["sent"] },
  { id: "failed", label: "Failed", keys: ["failed"] },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>("scheduled");
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([api.list(group), api.stats()]);
      setEmails(list);
      setStats(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[22rem_1fr]">
      <header className="flex items-center justify-between gap-4 lg:col-span-2">
        <h1 className="text-2xl font-bold tracking-tight">Send later</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-mute sm:inline">{user?.name}</span>
          <Link to="/logout"
            className="rounded-md border border-line bg-white px-3 py-1.5 font-semibold hover:border-sea hover:text-sea">
            Log out
          </Link>
        </div>
      </header>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-6 text-sm text-mute">
          Write an email now and pick when it goes out. Jobs are stored in Redis, so a server restart won't lose them.
        </p>
        <ScheduleForm onCreated={refresh} />
      </aside>

      <main>
        <div role="tablist" className="mb-4 flex gap-6 border-b border-line">
          {tabs.map((t) => {
            const count = t.keys.reduce((n, k) => n + (stats[k] ?? 0), 0);
            const active = group === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={active} onClick={() => setGroup(t.id)}
                className={`-mb-px border-b-2 pb-2 text-sm font-semibold ${
                  active ? "border-sea text-ink" : "border-transparent text-mute hover:text-ink"
                }`}>
                {t.label} <span className="ml-1 font-normal text-mute">{count}</span>
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Can't reach the server: {error}. Check that the backend is running on port 4000.
          </p>
        )}
        <EmailList group={group} emails={emails} loading={loading} onChanged={refresh} />
      </main>
    </div>
  );
}
