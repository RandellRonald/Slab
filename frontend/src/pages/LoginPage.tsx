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
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
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
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        {submitError || error ? <ErrorState title="Sign in failed" message={submitError ?? error ?? "Sign in failed."} /> : null}
        {socialNotice ? <p className="rounded-md border border-slab-border bg-slate-50 px-3 py-2 text-sm text-slab-muted">{socialNotice}</p> : null}
        <label className="block text-sm font-semibold text-slab-ink">
          Email
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold text-slab-ink">
          Password
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" minLength={8} />
        </label>
        <Button className="w-full" disabled={submitting}>{submitting ? "Signing in" : "Sign in"}</Button>
        {!adminOnly ? <div className="grid grid-cols-2 gap-3 border-t border-slab-border pt-4">
          <Button type="button" variant="secondary" onClick={() => void onProviderSignIn("Google")} disabled={submitting}>Continue with Google</Button>
          <Button type="button" variant="secondary" onClick={() => void onProviderSignIn("Apple")} disabled={submitting}>Continue with Apple</Button>
        </div> : null}
        {!adminOnly ? (
          <div className="border-t border-slab-border pt-4 text-center text-sm text-slab-muted">
            <Link className="font-bold text-slab-ink hover:text-slab-primaryStrong" to="/admin/login">
              Admin Sign In
            </Link>
          </div>
        ) : null}
      </form>
    </section>
  );

  async function onProviderSignIn(provider: "Google" | "Apple") {
    // OAuth requires a provider configuration; never manufacture a local session for it.
    setSubmitError(null);
    setSocialNotice(`${provider} Sign-In is not configured for this environment.`);
  }
}
