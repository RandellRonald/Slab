import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/AuthProvider";

export function DashboardPage() {
  const { user } = useAuth();
  const roleHref = user?.role === "admin" ? "/admin" : user?.role === "provider" ? "/provider" : "/customer";

  return (
    <section>
      <h1 className="text-3xl font-black text-slab-ink">Dashboard</h1>
      <p className="mt-2 text-slab-muted">Your authenticated Phase 1 workspace is ready.</p>
      <div className="mt-6 rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slab-muted">Role</dt>
            <dd className="mt-1 font-bold capitalize text-slab-ink">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slab-muted">Profile</dt>
            <dd className="mt-1 font-bold text-slab-ink">{user?.full_name ?? user?.email}</dd>
            <dd className="mt-1 text-sm text-slab-muted">{user?.email}</dd>
            <dd className="mt-3 text-sm text-slab-muted">Joined {user?.joined_at ? new Date(user.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "recently"}</dd>
          </div>
        </dl>
        <Link className="mt-6 inline-flex" to={roleHref}>
          <Button>Open role workspace</Button>
        </Link>
      </div>
    </section>
  );
}
