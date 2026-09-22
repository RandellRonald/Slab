import { useEffect, useState } from "react";

import { apiClient, request } from "../api/client";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";

interface AdminDashboard {
  stats: Record<string, number>;
  customers: Array<Record<string, unknown>>;
  providers: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  bookings: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  disputes: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
}

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const result = await request<AdminDashboard>(apiClient.get("/admin/dashboard"));
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Admin dashboard could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading admin operations" />;
  if (error) return <ErrorState title="Admin dashboard error" message={error} />;
  if (!data) return <ErrorState title="Admin dashboard unavailable" message="No operational data was returned." />;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-black uppercase text-slab-primaryStrong">SLAB Operations</p>
        <h1 className="mt-2 text-3xl font-black text-slab-ink">Admin dashboard</h1>
        <p className="mt-2 text-slab-muted">Live operational view of customers, providers, bookings, payments and support work.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customers" value={data.stats.customers} />
        <Stat label="Providers" value={data.stats.providers} />
        <Stat label="Equipment" value={data.stats.equipment} />
        <Stat label="Bookings" value={data.stats.bookings} />
        <Stat label="Projects" value={data.stats.projects} />
        <Stat label="Payments" value={data.stats.payments} />
        <Stat label="Open disputes" value={data.stats.open_disputes} />
        <Stat label="Platform revenue" value={`₹${Number(data.stats.platform_revenue_inr || 0).toLocaleString("en-IN")}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataPanel title="Customers" rows={data.customers} columns={["full_name", "email", "role"]} />
        <DataPanel title="Providers" rows={data.providers} columns={["company_name", "verification_status", "equipment_count"]} />
        <DataPanel title="Equipment" rows={data.equipment} columns={["display_name", "status", "daily_rate"]} />
        <DataPanel title="Bookings" rows={data.bookings} columns={["status", "starts_at", "requirements"]} />
        <DataPanel title="Payments" rows={data.payments} columns={["status", "amount_cents", "currency"]} />
        <DataPanel title="Projects" rows={data.projects} columns={["project_name", "site_contact_name", "description"]} />
        <DataPanel title="Disputes and reviews" rows={[...data.disputes, ...data.reviews]} columns={["status", "reason", "comment"]} />
        <DataPanel title="Recent activity" rows={[...data.notifications, ...data.activity]} columns={["title", "body", "to_status"]} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <article className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-slab-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-slab-ink">{value ?? 0}</p>
    </article>
  );
}

function DataPanel({ title, rows, columns }: { title: string; rows: Array<Record<string, unknown>>; columns: string[] }) {
  return (
    <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-slab-ink">{title}</h2>
        <span className="rounded-full bg-slab-primary/20 px-3 py-1 text-xs font-black text-slab-ink">{rows.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.slice(0, 6).map((row, index) => (
          <article className="rounded-md border border-slab-border bg-slate-50 p-3" key={`${title}-${index}`}>
            {columns.map((column) => (
              <p className="truncate text-sm" key={column}>
                <span className="font-semibold text-slab-muted">{labelize(column)}: </span>
                <span className="font-bold text-slab-ink">{formatValue(row[column])}</span>
              </p>
            ))}
          </article>
        ))}
        {rows.length === 0 ? <p className="text-sm text-slab-muted">No records available.</p> : null}
      </div>
    </section>
  );
}

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
