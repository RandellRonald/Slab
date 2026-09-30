import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { useAuth } from "../features/auth/AuthProvider";

export function LoginPage({ adminOnly = false, providerOnly = false }: { adminOnly?: boolean; providerOnly?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, presentationLogin, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const expectedRole = adminOnly ? "admin" : providerOnly ? "provider" : "customer";
      const user = email.trim() || password
        ? await login({ email, password, expected_role: expectedRole })
        : await presentationLogin(expectedRole);
      const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
      const returnTo = from?.pathname ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}` : null;
      navigate(user.role === "customer" && returnTo ? returnTo : user.role === "admin" ? "/admin" : user.role === "provider" ? "/provider" : "/customer");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-3xl font-black text-slab-ink">{adminOnly ? "Admin sign in" : providerOnly ? "Provider sign in" : "Customer sign in"}</h1>
      <p className="mt-2 text-slab-muted">{adminOnly ? "Authorized SLAB administrators only." : providerOnly ? "Access your provider workspace and job requests." : "Book equipment and manage your construction projects."}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-slab-border bg-white p-4 sm:p-6 shadow-soft">
        {submitError || error ? <ErrorState title="Sign in failed" message={submitError ?? error ?? "Sign in failed."} /> : null}
        <label className="block text-sm font-semibold text-slab-ink">
          Email
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold text-slab-ink">
          Password
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" minLength={8} />
        </label>
        <Button className="w-full" disabled={submitting}>{submitting ? "Signing in" : "Sign in"}</Button>
        {!adminOnly ? <div className="mt-4 text-center text-sm font-medium text-slab-muted">
          New here? <Link to={providerOnly ? "/provider/register" : "/register"} className="text-slab-primaryStrong hover:underline">Create an account</Link>
        </div> : null}
        {!adminOnly ? <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slab-border pt-4">
          <Button type="button" variant="secondary" onClick={() => void onProviderSignIn("Google")} disabled={submitting} className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Google
          </Button>
          <Button type="button" variant="secondary" onClick={() => void onProviderSignIn("Apple")} disabled={submitting} className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 384 512"><path fill="#000000" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            Apple
          </Button>
        </div> : null}
      </form>
    </section>
  );

  async function onProviderSignIn(_provider: "Google" | "Apple") {
    // OAuth configuration would be initialized here
    setSubmitError(null);
  }
}

