import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { useAuth } from "../features/auth/AuthProvider";
import type { AppRole } from "../types/auth";

export function RegisterPage({ provider = false }: { provider?: boolean }) {
  const navigate = useNavigate();
  const { register, error } = useAuth();
  const role: AppRole = provider ? "provider" : "customer";
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await register({
        email: String(form.get("email")),
        password: String(form.get("password")),
        full_name: String(form.get("full_name")),
        phone: String(form.get("phone") ?? ""),
        role
      });
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-3xl font-black text-slab-ink">{provider ? "Provider registration" : "Customer registration"}</h1>
      <p className="mt-2 text-slab-muted">{provider ? "Start your provider onboarding and verification with SLAB." : "Create a customer account to book and manage equipment."}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        {error ? <ErrorState title="Registration failed" message={error} /> : null}
        <label className="block text-sm font-semibold text-slab-ink">
          Full name
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" name="full_name" required />
        </label>
        <label className="block text-sm font-semibold text-slab-ink">
          Email
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" name="email" type="email" required />
        </label>
        <label className="block text-sm font-semibold text-slab-ink">
          Phone
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" name="phone" />
        </label>
        <label className="block text-sm font-semibold text-slab-ink">
          Password
          <input className="mt-2 w-full rounded-md border border-slab-border px-3 py-2" name="password" type="password" required minLength={8} />
        </label>
        <Button className="w-full" disabled={submitting}>{submitting ? "Creating account" : "Create account"}</Button>
      </form>
    </section>
  );
}
