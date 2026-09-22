import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";

export function UnauthorizedPage() {
  return (
    <section className="mx-auto max-w-lg rounded-lg border border-slab-border bg-white p-6 shadow-soft">
      <h1 className="text-3xl font-black text-slab-ink">Unauthorized</h1>
      <p className="mt-2 text-slab-muted">Your current role cannot access that SLAB workspace.</p>
      <Link className="mt-6 inline-flex" to="/dashboard">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </section>
  );
}
