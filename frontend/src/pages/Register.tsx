import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import AuthLayout, { buttonClass, fieldClass } from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    try {
      await register(name, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Takes a few seconds. Your scheduled emails stay private to you."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-sea underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label>
          <input id="name" required maxLength={80} autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password"
            placeholder="At least 8 characters" />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm font-medium">Confirm password</label>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button disabled={busy} className={buttonClass}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
    </AuthLayout>
  );
}
