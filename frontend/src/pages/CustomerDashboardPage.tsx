import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/AuthProvider";

export function CustomerDashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <h1 className="text-3xl font-black text-slab-ink">Customer dashboard</h1>
      <p className="mt-2 text-slab-muted">Manage your projects, equipment bookings, and dispatch updates.</p>
      <section className="mt-6 rounded-lg border border-slab-border bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-slab-muted">Profile</p>
        <p className="mt-1 text-xl font-black text-slab-ink">{user?.full_name || "SLAB customer"}</p>
        <p className="mt-1 text-sm text-slab-muted">{user?.email}</p>
        <p className="mt-3 text-sm text-slab-muted">Joined {user?.joined_at ? new Date(user.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "recently"}</p>
      </section>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/customer/workspace"><Button>Manage Projects</Button></Link>
        <Link to="/booking"><Button variant="secondary">Book Equipment</Button></Link>
      </div>
    </>
  );
}
