import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import AuthLayout, { buttonClass } from "../components/AuthLayout";

// Visiting /logout ends the session (server clears the cookie) and shows a confirmation.
export default function Logout() {
  const { logout } = useAuth();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    logout().then(() => setDone(true)).catch(() => { setDone(true); setFailed(true); });
  }, [logout]);

  if (!done) {
    return (
      <AuthLayout title="Signing you out…">
        <p className="text-sm text-mute">One moment.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="You've been signed out"
      subtitle={failed
        ? "We couldn't reach the server, so your session may still be active until it expires."
        : "Your session has ended. Scheduled emails will still go out on time."}>
      <Link to="/login" className={`${buttonClass} block text-center`}>Sign in again</Link>
    </AuthLayout>
  );
}
