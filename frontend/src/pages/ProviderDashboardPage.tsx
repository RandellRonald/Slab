import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { AlertTriangle, Bell, CalendarX, CheckCircle2, Clock, FileCheck2, IndianRupee, MapPinned, Navigation, Phone, Radio, Upload, Wrench, XCircle } from "lucide-react";
import { AnchorHTMLAttributes, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { useAuth } from "../features/auth/AuthProvider";
import { providerService, JobAssignment, ProviderDashboard, ProviderEquipmentInput, ProviderRequest } from "../services/providerService";
import { mapService } from "../services/customerService";

export function ProviderDashboardPage() {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [acceptedRequest, setAcceptedRequest] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const requestIds = useRef<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      setDashboard(await providerService.dashboard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load provider dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    const pending = dashboard?.pending_requests.map((item) => item.id) ?? [];
    const newIds = pending.filter((id) => !requestIds.current.includes(id));
    if (requestIds.current.length && newIds.length) {
      void playJobAlert();
      if ("vibrate" in navigator) navigator.vibrate?.([180, 80, 180]);
      const timers = newIds.map((id) => window.setTimeout(() => setDismissedAlerts((current) => [...new Set([...current, id])]), 9000));
      requestIds.current = pending;
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }
    requestIds.current = pending;
  }, [dashboard?.pending_requests]);

  useEffect(() => {
    setDismissedAlerts((current) => current.filter((id) => dashboard?.pending_requests.some((request) => request.id === id)));
  }, [dashboard?.pending_requests]);

  async function perform(action: () => Promise<unknown>) {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider action failed.");
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() =>
      providerService.submitVerification({
        personal_details: { full_name: String(form.get("full_name")), licence_number: String(form.get("licence_number")) },
        contact_details: { phone: String(form.get("phone")), email: String(form.get("email")) },
        address: { line1: String(form.get("address")), city: String(form.get("city")) },
        equipment_summary: { primary_equipment: String(form.get("primary_equipment")) }
      })
    );
  }

  async function submitEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: ProviderEquipmentInput = {
      equipment_type_slug: String(form.get("equipment_type_slug")),
      display_name: String(form.get("display_name")),
      registration_number: String(form.get("registration_number") ?? ""),
      identification_number: String(form.get("identification_number") ?? ""),
      status: "available",
      hourly_rate: Number(form.get("hourly_rate") || 0),
      daily_rate: Number(form.get("daily_rate") || 0),
      monthly_rate: Number(form.get("monthly_rate") || 0),
      operating_latitude: Number(form.get("operating_latitude") || 0),
      operating_longitude: Number(form.get("operating_longitude") || 0),
      operating_radius_km: Number(form.get("operating_radius_km") || 50),
      photo_urls: [],
      document_urls: []
    };
    await perform(() => providerService.createEquipment(payload));
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !user) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.user_id}/${Date.now()}-${safeName}`;
    await perform(async () => {
      const storagePath = await providerService.uploadDocument(file, path);
      return providerService.createDocument({
        document_type: String(form.get("document_type")),
        storage_path: storagePath,
        storage_bucket: "provider-documents",
        expiry_date: String(form.get("expiry_date") || "") || null
      });
    });
    event.currentTarget.reset();
  }

  if (loading) return <LoadingState label="Loading provider dashboard" />;

  return (
    <section className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase text-slab-primaryStrong">Provider operations</p>
          <h1 className="mt-2 text-3xl font-black text-slab-ink">Provider dashboard</h1>
          <p className="mt-2 text-slab-muted">Realtime-ready dispatch data is always refetched from FastAPI on reconnect.</p>
        </div>
        <Button variant={dashboard?.provider?.is_online ? "secondary" : "primary"} onClick={() => perform(() => providerService.updateStatus(!dashboard?.provider?.is_online))}>
          <Radio size={16} /> {dashboard?.provider?.is_online ? "ONLINE" : "OFFLINE"}
        </Button>
      </div>

      {dashboard?.provider?.is_online ? (
        <JobAlerts
          requests={(dashboard.instant_requests?.length ? dashboard.instant_requests : dashboard.pending_requests).filter((request) => !dismissedAlerts.includes(request.id))}
          acceptedRequest={acceptedRequest}
          onAccept={(request) => perform(async () => { await providerService.acceptRequest(request.id); setAcceptedRequest(request.id); setDismissedAlerts((current) => [...new Set([...current, request.id])]); })}
          onDecline={(request) => perform(async () => { await providerService.rejectRequest(request.id, "Unavailable"); setDismissedAlerts((current) => [...new Set([...current, request.id])]); })}
        />
      ) : (
        <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-slab-muted">Provider status</p>
          <h2 className="mt-2 text-2xl font-black text-slab-ink">You are offline.</h2>
          <p className="mt-2 text-slab-muted">Switch ONLINE to receive normal and emergency job alerts.</p>
        </section>
      )}

      <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-slab-muted">Profile</p>
        <p className="mt-1 text-xl font-black text-slab-ink">{user?.full_name || "SLAB provider"}</p>
        <p className="mt-1 text-sm text-slab-muted">{user?.email}</p>
        <p className="mt-3 text-sm text-slab-muted">Joined {user?.joined_at ? new Date(user.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "recently"}</p>
      </section>

      <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-slab-muted">Primary equipment and operator</p>
        <p className="mt-1 text-xl font-black text-slab-ink">{dashboard?.primary_equipment?.display_name || "Equipment setup required"}</p>
        <p className="mt-1 text-sm text-slab-muted">{dashboard?.primary_equipment?.registration_number || "Equipment number pending"} · {dashboard?.primary_equipment?.status || "unavailable"}</p>
      </section>

      {error ? <ErrorState title="Provider dashboard error" message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FileCheck2 />} label="Verification" value={dashboard?.verification?.status ?? "not submitted"} />
        <Metric icon={<Wrench />} label="Equipment" value={String(dashboard?.equipment_count ?? 0)} />
        <Metric icon={<Clock />} label="New requests" value={String(dashboard?.pending_requests.length ?? 0)} />
        <Metric icon={<IndianRupee />} label="Earnings" value={formatINR(dashboard?.earnings.estimated_total ?? 0)} />
      </div>

      {dashboard?.verification?.status !== "approved" ? (
        <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-slab-ink">KYC and verification</h2>
          {dashboard?.verification?.rejection_reason ? <p className="mt-2 text-sm text-slab-error">{dashboard.verification.rejection_reason}</p> : null}
          <form onSubmit={submitVerification} className="mt-5 grid gap-4 md:grid-cols-2">
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="full_name" placeholder="Legal full name" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="phone" placeholder="Phone" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="email" type="email" placeholder="Email" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="licence_number" placeholder="Driving licence number" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="address" placeholder="Address" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="city" placeholder="City" />
            <input className="min-h-11 rounded-md border border-slab-border px-3 md:col-span-2" name="primary_equipment" placeholder="Primary equipment details" required />
            <Button className="md:col-span-2"><Upload size={16} /> Submit verification</Button>
          </form>
          <form onSubmit={submitDocument} className="mt-6 grid gap-3 rounded-md border border-slab-border bg-slate-50 p-4 md:grid-cols-[180px_1fr_160px_auto]">
            <select className="min-h-11 rounded-md border border-slab-border px-3" name="document_type" required>
              <option value="rc">RC</option>
              <option value="driving_licence">Driving licence</option>
              <option value="insurance">Insurance</option>
              <option value="profile_photo">Profile photo</option>
              <option value="equipment_photo">Equipment photo</option>
              <option value="other">Other document</option>
            </select>
            <input className="min-h-11 rounded-md border border-slab-border bg-white px-3" name="file" type="file" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="expiry_date" type="date" />
            <Button><Upload size={16} /> Upload</Button>
          </form>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-slab-ink">Instant requests</h2>
          <div className="mt-5 space-y-3">
            {dashboard?.provider?.is_online && dashboard?.instant_requests?.length ? (
              dashboard.instant_requests.map((request) => (
                <ProviderRequestCard
                  key={request.id}
                  request={request}
                  accepted={acceptedRequest === request.id}
                  onAccept={() => perform(async () => { await providerService.acceptRequest(request.id); setAcceptedRequest(request.id); })}
                  onDecline={() => perform(() => providerService.rejectRequest(request.id, "Unavailable"))}
                />
              ))
            ) : (
              <EmptyState title={dashboard?.provider?.is_online ? "No instant requests" : "Provider is offline"} message={dashboard?.provider?.is_online ? "New work requests appear here while you are online." : "Switch ONLINE to enable incoming job alerts."} />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-slab-ink">Notifications</h2>
          <div className="mt-5 space-y-3">
            {dashboard?.notifications.length ? dashboard.notifications.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-md border border-slab-border p-3 text-sm">
                <Bell className="text-slab-primaryStrong" size={18} />
                <div><p className="font-bold text-slab-ink">{item.title}</p><p className="text-slab-muted">{item.body}</p></div>
              </div>
            )) : <EmptyState title="No notifications" message="Request, dispatch, cancellation, and admin review updates will appear here." />}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-black text-slab-ink">Scheduled work</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {dashboard?.scheduled_work?.length ? dashboard.scheduled_work.map((job) => (
            <article key={job.id} className="rounded-md border border-slab-border p-4">
              <p className="font-bold text-slab-ink">{job.customer?.full_name || "Customer"}</p>
              <p className="mt-1 text-sm text-slab-muted">{job.items?.[0]?.equipment_type || "Equipment"} · {job.booking?.starts_at ? new Date(job.booking.starts_at).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Scheduled time"}</p>
              <p className="mt-1 text-sm text-slab-muted">Site: {job.booking?.site_location?.line1 || "Site location"}</p>
              <ActionRoute to={`/provider/jobs/${job.booking_id}`}>View work</ActionRoute>
            </article>
          )) : <EmptyState title="No scheduled work" message="Accepted future bookings reserve their time here." />}
        </div>
      </section>

      <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-black text-slab-ink">Active job</h2>
        {dashboard?.active_jobs.length ? (
          dashboard.active_jobs.map((job) => (
            <article key={job.id} className="mt-4 rounded-md border border-slab-border p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slab-primaryStrong">Job accepted</p>
              <p className="mt-1 font-bold text-slab-ink">{job.customer?.full_name || job.customer?.email || "Customer"}</p>
              <p className="mt-1 text-sm font-semibold text-slab-muted">Booking #{job.booking_id.slice(0, 8)} · {formatStatus(job.booking?.status || "assigned")}</p>
              <p className="mt-1 text-sm text-slab-muted">{job.booking?.site_location?.line1 ?? "Site details available in job view"}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <SmallStat label="Equipment" value={job.items?.[0]?.equipment_type?.replace(/_/g, " ") || "Equipment"} />
                  <SmallStat label="Distance" value={`${job.distance_km ?? "-"} km`} />
                  <SmallStat label="ETA" value={`${job.eta_minutes ?? "-"} min`} />
                </div>
                <CompactProviderMap job={job} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.customer?.phone ? <ActionLink href={`tel:${job.customer.phone}`}><Phone size={16} /> Call customer</ActionLink> : null}
                <ActionRoute to={`/provider/jobs/${job.booking_id}/chat`}>Chat customer</ActionRoute>
                {navigationUrl(job) ? <ActionLink href={navigationUrl(job)!} target="_blank" rel="noreferrer"><MapPinned size={16} /> Navigate to site</ActionLink> : null}
                <ActionRoute to={`/provider/jobs/${job.booking_id}`}>Job details</ActionRoute>
                <Button onClick={() => perform(() => providerService.markEnRoute(job.booking_id))}>En route</Button>
                <Button onClick={() => perform(() => providerService.markArrived(job.booking_id))}>Mark arrived</Button>
                <input className="min-h-10 w-28 rounded-md border border-slab-border px-3" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" />
                <Button onClick={() => perform(() => providerService.verifyPin(job.booking_id, pin))}>Verify PIN</Button>
                <Button onClick={() => perform(() => providerService.startJob(job.booking_id))}>Start</Button>
                <Button onClick={() => perform(() => providerService.completeJob(job.booking_id))}>Complete</Button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No active job" message="Accepted and assigned bookings will appear with dispatch controls." />
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submitEquipment} className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-slab-ink">Equipment management</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <select className="min-h-11 rounded-md border border-slab-border px-3" name="equipment_type_slug" required>
              <option value="excavator">Excavator</option>
              <option value="jcb">JCB / Backhoe</option>
              <option value="crane">Crane</option>
              <option value="mini_tipper">Mini Tipper</option>
              <option value="standard_tipper">Standard Tipper</option>
              <option value="heavy_tipper">Heavy / Large Tipper</option>
              <option value="loader">Loader</option>
              <option value="septic_tank_service">Septic Tank Service</option>
              <option value="septic_tank_cleaning">Septic Tank Cleaning</option>
              <option value="septic_tank_emptying">Septic Tank Emptying / Desludging</option>
              <option value="septic_tank_waste_removal">Sewage / Waste Removal</option>
              <option value="emergency_septic_service">Emergency Septic Service</option>
            </select>
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="display_name" placeholder="Equipment display name" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="registration_number" placeholder="Registration / RC" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="identification_number" placeholder="Identification number" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="hourly_rate" type="number" placeholder="Hourly rate" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="daily_rate" type="number" placeholder="Daily rate" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="operating_latitude" type="number" step="any" placeholder="Operating latitude" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="operating_longitude" type="number" step="any" placeholder="Operating longitude" />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="operating_radius_km" type="number" placeholder="Radius km" defaultValue={50} />
          </div>
          <Button className="mt-5"><Wrench size={16} /> Add equipment</Button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void perform(() => providerService.blockAvailability({ starts_at: String(form.get("starts_at")), ends_at: String(form.get("ends_at")), reason: String(form.get("reason") ?? "") }));
          }}
          className="rounded-lg border border-slab-border bg-white p-6 shadow-soft"
        >
          <h2 className="text-2xl font-black text-slab-ink">Availability blocks</h2>
          <div className="mt-5 grid gap-3">
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="starts_at" type="datetime-local" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="ends_at" type="datetime-local" required />
            <input className="min-h-11 rounded-md border border-slab-border px-3" name="reason" placeholder="Reason" />
          </div>
          <Button className="mt-5" variant="secondary"><CalendarX size={16} /> Block time</Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <JobList title="Upcoming jobs" jobs={dashboard?.active_jobs ?? []} />
        <JobList title="Completed jobs" jobs={dashboard?.completed_jobs ?? []} />
      </section>
    </section>
  );
}

function ActionLink({ className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slab-border bg-white px-4 py-2 text-sm font-semibold text-slab-ink transition hover:bg-slate-50 ${className}`} {...props} />;
}

function JobAlerts({ requests, acceptedRequest, onAccept, onDecline }: { requests: ProviderRequest[]; acceptedRequest: string | null; onAccept: (request: ProviderRequest) => void; onDecline: (request: ProviderRequest) => void }) {
  if (!requests.length) return null;
  return (
    <section className="rounded-lg border-2 border-slab-ink bg-white p-5 shadow-[8px_8px_0_rgba(17,24,39,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slab-primaryStrong">New job request</p>
          <h2 className="mt-1 text-2xl font-black text-slab-ink">Incoming work alert</h2>
        </div>
        <span className="rounded-full border border-slab-border bg-yellow-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slab-ink">{requests.length} active</span>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {requests.map((request) => <ProviderRequestCard key={request.id} request={request} accepted={acceptedRequest === request.id} onAccept={() => onAccept(request)} onDecline={() => onDecline(request)} prominent />)}
      </div>
    </section>
  );
}

function ProviderRequestCard({ request, accepted, onAccept, onDecline, prominent = false }: { request: ProviderRequest; accepted: boolean; onAccept: () => void; onDecline: () => void; prominent?: boolean }) {
  const emergency = isEmergencyRequest(request);
  const equipment = request.equipment?.display_name || request.items?.[0]?.equipment_type?.replace(/_/g, " ") || "Equipment service";
  const site = request.booking?.site_location;
  return (
    <article className={`rounded-md border ${emergency ? "border-slab-primaryStrong bg-yellow-50" : "border-slab-border bg-white"} p-4 ${prominent ? "shadow-soft" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slab-primaryStrong">{emergency ? "Emergency" : "Standard"}</p>
            {emergency ? <span className="inline-flex items-center gap-1 rounded-full bg-slab-ink px-2 py-1 text-xs font-black uppercase text-white"><AlertTriangle size={13} /> Emergency</span> : null}
          </div>
          <h3 className="mt-2 text-xl font-black capitalize text-slab-ink">{equipment}</h3>
          <p className="mt-1 text-sm font-semibold text-slab-muted">{request.customer?.full_name || request.customer?.email || "Customer request"}</p>
        </div>
        <p className="text-right text-xl font-black text-slab-ink">{formatINR(request.estimated_amount ?? 0)}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SmallStat label="Location" value={site?.line1 || site?.city || "Site location pending"} />
        <SmallStat label="Distance" value={`${request.distance_km ?? "-"} km`} />
        <SmallStat label="ETA" value={`${request.eta_minutes ?? "-"} min`} />
        <SmallStat label="Job time" value={request.booking?.starts_at ? new Date(request.booking.starts_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Immediate"} />
      </div>
      {emergency ? <p className="mt-3 rounded-md border border-slab-border bg-white px-3 py-2 text-sm font-bold text-slab-ink">SLAB Emergency Booking Fee: ₹0 · urgent dispatch</p> : null}
      <CompactProviderMap request={request} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={onAccept}><CheckCircle2 size={16} /> {accepted ? "JOB ACCEPTED" : "ACCEPT"}</Button>
        <Button variant="secondary" onClick={onDecline}><XCircle size={16} /> DECLINE</Button>
      </div>
    </article>
  );
}

function CompactProviderMap({ request, job }: { request?: ProviderRequest; job?: JobAssignment }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const site = request?.booking?.site_location ?? job?.booking?.site_location;
  const equipment = request?.equipment;
  const destination = coordinate(site?.latitude, site?.longitude);
  const origin = coordinate(equipment?.operating_latitude, equipment?.operating_longitude) || offsetOrigin(destination);

  useEffect(() => {
    if (!mapNode.current || !origin || !destination || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: providerMapStyle,
      center: [(origin.longitude + destination.longitude) / 2, (origin.latitude + destination.latitude) / 2],
      zoom: 11,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", async () => {
      let line = [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]];
      try {
        const route = await mapService.route(origin, destination);
        const coords = (route.geometry as { coordinates?: number[][] } | undefined)?.coordinates;
        if (coords?.length) line = coords;
      } catch {
        // The compact dashboard map remains useful with a direct fallback if OSRM is unavailable.
      }
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } } });
      map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#d99a00", "line-width": 4, "line-opacity": 0.9 } });
      new maplibregl.Marker({ color: "#111827" }).setLngLat([origin.longitude, origin.latitude]).addTo(map);
      new maplibregl.Marker({ color: "#f5c400" }).setLngLat([destination.longitude, destination.latitude]).addTo(map);
      const bounds = new maplibregl.LngLatBounds([origin.longitude, origin.latitude], [origin.longitude, origin.latitude]);
      bounds.extend([destination.longitude, destination.latitude]);
      map.fitBounds(bounds, { padding: 28, duration: 0 });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [destination?.latitude, destination?.longitude, origin?.latitude, origin?.longitude]);

  if (!origin || !destination) {
    return <div className="mt-4 rounded-md border border-slab-border bg-slate-50 p-4 text-sm font-semibold text-slab-muted">Route appears after site coordinates are available.</div>;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slab-border bg-slate-100">
      <div ref={mapNode} className="h-44 w-full" />
      <div className="flex items-center justify-between border-t border-slab-border bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slab-ink">
        <span>Provider</span>
        <Navigation size={14} className="text-slab-primaryStrong" />
        <span>Job Site</span>
      </div>
    </div>
  );
}

function ActionRoute({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slab-border bg-white px-4 py-2 text-sm font-semibold text-slab-ink transition hover:bg-slate-50" to={to}>{children}</Link>;
}

function navigationUrl(job: { booking?: { site_location?: { latitude?: number; longitude?: number } } | null }) {
  const latitude = job.booking?.site_location?.latitude;
  const longitude = job.booking?.site_location?.longitude;
  return typeof latitude === "number" && typeof longitude === "number"
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${latitude},${longitude}`
    : null;
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slab-border bg-white px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slab-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-slab-ink">{value}</p>
    </div>
  );
}

function isEmergencyRequest(request: ProviderRequest) {
  return Boolean(request.booking?.pricing_snapshot?.is_emergency || request.items?.some((item) => String(item.equipment_type || "").includes("emergency")));
}

async function playJobAlert() {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    gain.connect(context.destination);
    [620, 820].forEach((frequency, index) => {
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.value = frequency;
      tone.connect(gain);
      tone.start(context.currentTime + index * 0.18);
      tone.stop(context.currentTime + index * 0.18 + 0.16);
    });
    window.setTimeout(() => void context.close(), 900);
  } catch {
    return;
  }
}

const providerMapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", minzoom: 0, maxzoom: 19 }],
};

function coordinate(latitude?: number, longitude?: number) {
  return typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null;
}

function offsetOrigin(destination: { latitude: number; longitude: number } | null) {
  return destination ? { latitude: destination.latitude - 0.035, longitude: destination.longitude - 0.045 } : null;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
      <div className="text-slab-primaryStrong">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slab-muted">{label}</p>
      <p className="mt-1 text-2xl font-black capitalize text-slab-ink">{value}</p>
    </article>
  );
}

function JobList({ title, jobs }: { title: string; jobs: JobAssignment[] }) {
  return (
    <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
      <h2 className="text-xl font-black text-slab-ink">{title}</h2>
      <div className="mt-4 space-y-2">
        {jobs.length ? jobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 rounded-md border border-slab-border p-3 text-sm">
            <CheckCircle2 className="text-slab-primaryStrong" size={18} />
            <div><p className="font-semibold text-slab-ink">{job.customer?.full_name || job.customer?.email || "Customer"}</p><p className="text-slab-muted">Booking #{job.booking_id.slice(0, 8)}</p></div>
          </div>
        )) : <EmptyState title={`No ${title.toLowerCase()}`} message="This list will populate from FastAPI records." />}
      </div>
    </section>
  );
}
