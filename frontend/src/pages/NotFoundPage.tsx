import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg rounded-lg border border-slab-border bg-white p-6 shadow-soft">
      <h1 className="text-3xl font-black text-slab-ink">Page not found</h1>
      <p className="mt-2 text-slab-muted">That route is not part of the Phase 1 foundation.</p>
      <Link className="mt-6 inline-flex" to="/">
        <Button variant="secondary">Go home</Button>
      </Link>
    </section>
  );
}
