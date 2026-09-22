import { FormEvent, PointerEvent, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { MapPinned, MessageSquare, Phone } from "lucide-react";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { JobAssignment, providerService } from "../services/providerService";

export function ProviderJobPage() {
  const { bookingId = "" } = useParams();
  const location = useLocation();
  const isChat = location.pathname.endsWith("/chat");
  const [job, setJob] = useState<JobAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pin, setPin] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setJob(await providerService.jobDetail(bookingId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [bookingId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function perform(action: () => Promise<unknown>) {
    try {
      await action();
      setJob(await providerService.jobDetail(bookingId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Job action could not be completed.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await providerService.messageCustomer(bookingId, String(form.get("message")));
      setSent(true);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    }
  }

  if (loading) return <LoadingState label="Loading job" />;

  return (
    <section className="space-y-6">
      <Link className="text-sm font-semibold text-slab-muted hover:text-slab-ink" to="/provider">Back to provider dashboard</Link>
      {error ? <ErrorState title="Job error" message={error} /> : null}
      {!job ? <EmptyState title="Job not found" message="Assigned jobs are loaded from the SLAB API." /> : null}
      {job ? (
        <>
          <div className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
            <p className="text-sm font-bold uppercase text-slab-primaryStrong">Assigned job</p>
            <h1 className="mt-2 text-3xl font-black text-slab-ink">Booking {job.booking_id.slice(0, 8)}</h1>
            <p className="mt-2 text-slab-muted">{job.booking?.site_location?.line1 ?? "Site address not provided"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {job.customer?.phone ? <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slab-border bg-white px-4 py-2 text-sm font-semibold text-slab-ink" href={`tel:${job.customer.phone}`}><Phone size={16} /> Call customer</a> : null}
              {navigationUrl(job) ? <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slab-border bg-white px-4 py-2 text-sm font-semibold text-slab-ink" href={navigationUrl(job)!} target="_blank" rel="noreferrer"><MapPinned size={16} /> Navigate</a> : null}
              <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slab-border bg-white px-4 py-2 text-sm font-semibold text-slab-ink" to={`/provider/jobs/${job.booking_id}/chat`}><MessageSquare size={16} /> Chat</Link>
            </div>
          </div>

          <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
            <p className="text-sm font-bold uppercase text-slab-primaryStrong">Live job workflow</p>
            <h2 className="mt-2 text-2xl font-black text-slab-ink">{statusLabel(job.booking?.status)}</h2>
            {job.booking?.status === "assigned" ? <Button className="mt-5" onClick={() => void perform(() => providerService.markEnRoute(bookingId))}>Start navigation</Button> : null}
            {job.booking?.status === "provider_en_route" ? <SwipeConfirm label="Slide to confirm arrival" onConfirm={() => perform(() => providerService.markArrived(bookingId))} /> : null}
            {job.booking?.status === "provider_arrived" ? <div className="mt-5 space-y-3"><p className="font-semibold text-slab-ink">Reached destination</p><div className="flex flex-wrap gap-2"><input className="min-h-10 w-36 rounded-md border border-slab-border px-3" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="6-digit PIN" /><Button variant="secondary" onClick={() => void perform(async () => { await providerService.verifyPin(bookingId, pin); setPinVerified(true); })}>Verify PIN</Button></div>{pinVerified ? <SwipeConfirm label="Slide to start work" onConfirm={() => perform(() => providerService.startJob(bookingId))} /> : null}</div> : null}
            {job.booking?.status === "in_progress" ? <div className="mt-5"><p className="font-bold text-slab-ink">Work time {elapsed(job.started_at, now)}</p><div className="mt-3 flex gap-2"><SwipeConfirm label="Slide to take a break" onConfirm={() => perform(() => providerService.takeBreak(bookingId))} /><SwipeConfirm label="Slide to finish work" onConfirm={() => perform(() => providerService.completeJob(bookingId))} /></div></div> : null}
            {job.booking?.status === "on_break" ? <div className="mt-5"><p className="font-bold text-slab-ink">Work is paused</p><Button className="mt-3" onClick={() => void perform(() => providerService.resumeJob(bookingId))}>Resume work</Button></div> : null}
            {job.booking?.status === "completed" ? <CompletionSummary job={job} /> : null}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-slab-ink">Job details</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="Status" value={job.booking?.status ?? "assigned"} />
                <Detail label="Start" value={job.booking?.starts_at ? new Date(job.booking.starts_at).toLocaleString() : "-"} />
                <Detail label="End" value={job.booking?.ends_at ? new Date(job.booking.ends_at).toLocaleString() : "-"} />
                <Detail label="Customer" value={job.customer?.full_name ?? job.customer?.phone ?? "Customer"} />
              </dl>
              <h3 className="mt-6 font-bold text-slab-ink">Equipment</h3>
              <div className="mt-3 space-y-2">
                {job.items?.length ? job.items.map((item) => (
                  <div key={`${item.equipment_type}-${item.quantity}`} className="rounded-md border border-slab-border p-3 text-sm">
                    <span className="font-bold text-slab-ink">{item.quantity} x {item.equipment_type}</span>
                    <span className="ml-2 text-slab-muted">{item.duration_hours} hrs, operator {item.operator_required ? "required" : "not required"}</span>
                  </div>
                )) : <EmptyState title="No equipment items" message="Booking item records will appear here." />}
              </div>
              <h3 className="mt-6 font-bold text-slab-ink">Requirements</h3>
              <p className="mt-2 text-sm text-slab-muted">{job.booking?.requirements ?? "No special requirements recorded."}</p>
            </section>

            {isChat ? (
              <form onSubmit={sendMessage} className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
                <h2 className="text-xl font-black text-slab-ink">Message customer</h2>
                {sent ? <p className="mt-2 text-sm font-semibold text-green-700">Message sent to the customer notification center.</p> : null}
                <textarea className="mt-4 min-h-36 w-full rounded-md border border-slab-border p-3" name="message" placeholder="Write a concise update for the customer" required />
                <Button className="mt-4"><MessageSquare size={16} /> Send message</Button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SwipeConfirm({ label, onConfirm }: { label: string; onConfirm: () => Promise<unknown> }) {
  const [start, setStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  function finish() { if (progress > 0.82) void onConfirm(); setStart(null); setProgress(0); }
  return <div className="mt-5 select-none rounded-full bg-slate-100 p-1" onPointerMove={(event: PointerEvent<HTMLDivElement>) => { if (start !== null) setProgress(Math.max(0, Math.min(1, (event.clientX - start) / Math.max(1, event.currentTarget.clientWidth - 52)))); }} onPointerUp={finish} onPointerCancel={() => { setStart(null); setProgress(0); }}>
    <div className="flex h-12 items-center rounded-full bg-white pr-4 shadow-sm"><button type="button" className="h-10 w-10 shrink-0 rounded-full bg-slab-yellow font-black text-slab-ink touch-none" style={{ transform: `translateX(${progress * 100}%)` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setStart(event.clientX); }}>→</button><span className="flex-1 text-center text-sm font-bold text-slab-ink">{label} →</span></div>
  </div>;
}

function CompletionSummary({ job }: { job: JobAssignment }) {
  const snapshot = (job.booking as { pricing_snapshot?: Record<string, unknown> } | null)?.pricing_snapshot ?? {};
  const service = Number(snapshot.service_amount ?? job.estimated_amount ?? 0);
  const travel = Number(snapshot.travel_charge ?? snapshot.travel ?? 0);
  const fee = Number(snapshot.platform_fee ?? 0);
  return <div className="mt-5 grid gap-2 rounded-md border border-slab-border bg-slate-50 p-4 text-sm"><p className="font-black text-slab-ink">Job completed</p><p>Customer: {job.customer?.full_name || "Customer"}</p><p>Booking #{job.booking_id.slice(0, 8)}</p><p>Equipment service: ₹{service.toLocaleString("en-IN")}</p><p>Travel: ₹{travel.toLocaleString("en-IN")}</p><p>SLAB platform fee: ₹{fee.toLocaleString("en-IN")}</p><p className="font-bold">Total recorded: ₹{(service + travel + fee).toLocaleString("en-IN")}</p><p className="text-slab-muted">Service amount is settled directly with the customer. SLAB fee is handled through booking payment.</p></div>;
}

function elapsed(startedAt: string | null | undefined, now: number) {
  if (!startedAt) return "00:00:00";
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

function statusLabel(status?: string) {
  return status === "provider_en_route" ? "Navigating to site" : status === "provider_arrived" ? "Ready to start work" : status === "in_progress" ? "Work in progress" : status === "on_break" ? "Work paused" : status === "completed" ? "Work completed" : "Accepted";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slab-muted">{label}</dt>
      <dd className="mt-1 font-bold text-slab-ink">{value}</dd>
    </div>
  );
}

function navigationUrl(job: JobAssignment) {
  const latitude = job.booking?.site_location?.latitude;
  const longitude = job.booking?.site_location?.longitude;
  return typeof latitude === "number" && typeof longitude === "number"
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${latitude},${longitude}`
    : null;
}
