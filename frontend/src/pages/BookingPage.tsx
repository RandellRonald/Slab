import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { LocationPicker } from "../components/maps/LocationPicker";
import { customerService } from "../services/customerService";
import type { ProjectInput } from "../services/customerService";
import type { BookingItem, PricingEstimate } from "../types/phase2";

const equipmentOptions = ["hydra_crane", "mobile_truck_crane", "crawler_crane", "tower_crane", "rough_terrain_crane", "all_terrain_crane", "jcb_backhoe_loader", "mini_jcb", "skid_steer_loader", "wheel_loader", "excavator", "mini_excavator", "mini_tipper", "standard_tipper", "heavy_tipper", "loader", "septic_tank_service", "septic_tank_cleaning", "septic_tank_emptying", "septic_tank_waste_removal", "emergency_septic_service", "waste_management", "sewage_waste_transportation"];
const equipmentLabels: Record<string, string> = { hydra_crane: "Hydra / Pick & Carry Crane", mobile_truck_crane: "Mobile Truck Crane", crawler_crane: "Crawler Crane", tower_crane: "Tower Crane", rough_terrain_crane: "Rough Terrain Crane", all_terrain_crane: "All Terrain Crane", jcb_backhoe_loader: "JCB Backhoe Loader", mini_jcb: "Mini JCB / Mini Backhoe", skid_steer_loader: "Skid Steer Loader", wheel_loader: "Wheel Loader", excavator: "Excavator", mini_excavator: "Mini Excavator", mini_tipper: "Mini Tipper", standard_tipper: "Standard Tipper", heavy_tipper: "Heavy / Large Tipper", loader: "Loader", septic_tank_service: "Septic Tank Service", septic_tank_cleaning: "Septic Tank Cleaning", septic_tank_emptying: "Septic Tank Emptying / Desludging", septic_tank_waste_removal: "Sewage / Waste Removal", emergency_septic_service: "Emergency Septic Service", waste_management: "Waste Management", sewage_waste_transportation: "Sewage / Waste Transportation" };
const initialSite = { line1: "Unconfirmed site", latitude: 10.5276, longitude: 76.2144, area: "", city: "", district: "", state: "", postal_code: "" };

export function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<BookingItem[]>([
    { equipment_type: "excavator", quantity: 1, duration_hours: 8, operator_required: true }
  ]);
  const [scheduleDurationHours, setScheduleDurationHours] = useState(8);
  const [estimate, setEstimate] = useState<PricingEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState(initialSite);
  const [projects, setProjects] = useState<Array<Record<string, any>>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isEmergency, setIsEmergency] = useState(searchParams.get("emergency") === "1");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const projectFormRef = useRef<HTMLDivElement>(null);
  const bookingDurationHours = useMemo(() => Math.max(1, ...items.map((item) => Number(item.duration_hours) || 1)), [items]);

  useEffect(() => {
    const requestedEquipment = searchParams.get("equipment");
    if (searchParams.get("emergency") === "1" && !requestedEquipment) {
      setIsEmergency(true);
      setScheduleDurationHours(2);
      setItems([{ equipment_type: "emergency_septic_service", quantity: 1, duration_hours: 2, operator_required: true }]);
      return;
    }
    if (!requestedEquipment || !equipmentOptions.includes(requestedEquipment)) return;
    if (searchParams.get("emergency") === "1") setIsEmergency(true);
    setItems((current) => [{ ...current[0], equipment_type: requestedEquipment }, ...current.slice(1)]);
  }, [searchParams]);

  useEffect(() => {
    refreshProjects().catch((err) => setError(err instanceof Error ? err.message : "Unable to load projects."));
  }, []);

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  async function calculate() {
    setError(null);
    try {
      setEstimate(await customerService.estimateBooking({ items, distance_km: 0, site_location: cleanSiteAddress(site), is_emergency: isEmergency }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to calculate pricing.");
    }
  }

  async function refreshProjects(selectId?: string) {
    const records = await customerService.listProjects() as Array<Record<string, any>>;
    setProjects(records);
    if (selectId) setSelectedProjectId(selectId);
  }

  async function createProject() {
    const panel = projectFormRef.current;
    if (!panel) return;
    const value = (name: string) => String((panel.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value || "");
    const latitude = Number(value("latitude"));
    const longitude = Number(value("longitude"));
    const note = value("note").trim();
    setError(null);
    setCreatingProject(true);
    try {
      const projectName = value("project_name").trim();
      const line1 = value("line1").trim();
      if (!projectName || !line1) {
        setError("Project name and site address are required.");
        return;
      }
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setError("Choose a valid project location before creating the project.");
        return;
      }
      const address = {
        line1,
        area: value("area").trim() || undefined,
        city: value("city").trim() || undefined,
        district: value("district").trim() || undefined,
        state: value("state").trim() || undefined,
        postal_code: value("postal_code").trim() || undefined,
        latitude,
        longitude,
      };
      const payload: ProjectInput = {
        project_name: projectName,
        address,
        latitude,
        longitude,
        site_contact_name: value("site_contact_name").trim() || undefined,
        site_contact_phone: value("site_contact_phone").trim() || undefined,
        description: value("description").trim() || undefined,
        requirements: value("requirements").trim() || undefined,
      };
      const project = await customerService.createProject(payload) as Record<string, any>;
      if (note.length >= 3 && project.id) await customerService.addProjectNote(String(project.id), { note, note_type: "note" });
      await refreshProjects(String(project.id));
      setShowProjectForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project.");
    } finally {
      setCreatingProject(false);
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      if (!estimate) {
        setError("Estimate the booking cost before continuing to review.");
        return;
      }
      const projectId = String(form.get("project_id") || "");
      const startsAt = String(form.get("starts_at"));
      const endsAt = estimatedEndFromStart(startsAt, bookingDurationHours);
      const normalizedStartsAt = normalizeDateTime(startsAt);
      if (!normalizedStartsAt || !endsAt) {
        setError("Choose a start date and estimated duration before continuing.");
        return;
      }
      navigate("/booking/review", { state: { project_id: projectId, project_name: projects.find((project) => project.id === projectId)?.project_name, items, site: cleanSiteAddress(site), starts_at: normalizedStartsAt, ends_at: endsAt, estimated_duration_hours: bookingDurationHours, distance_km: estimate.distance_km ?? 0, requirements: String(form.get("requirements") ?? ""), notes: String(form.get("notes") ?? ""), estimate, is_emergency: isEmergency } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create booking.");
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-slab-primaryStrong">Booking foundation</p>
        <h1 className="mt-2 text-3xl font-black text-slab-ink">Book equipment with backend pricing</h1>
        <p className="mt-2 text-slab-muted">Choose equipment, site, timing, duration, operator needs, photos, requirements, estimate, review, and submit.</p>
      </div>
      <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slab-primaryStrong">Emergency booking</p>
            <h2 className="mt-1 text-2xl font-black text-slab-ink">Need it urgently?</h2>
            <p className="mt-1 text-slab-muted">Get the nearest available provider to your site. SLAB Emergency Booking Fee is ₹0.</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setIsEmergency(true);
              setEstimate(null);
              setItems([{ equipment_type: "emergency_septic_service", quantity: 1, duration_hours: 2, operator_required: true }]);
            }}
          >
            Book Emergency Service →
          </Button>
        </div>
        {isEmergency ? <p className="mt-3 rounded-md border border-slab-border bg-yellow-50 px-3 py-2 text-sm font-semibold text-slab-ink">URGENT REQUEST · Provider nearby · ETA shown after matching</p> : null}
      </section>
      {error ? <ErrorState title="Booking action failed" message={error} /> : null}

      <LocationPicker onConfirm={(location) => setSite({ line1: location.address, latitude: location.latitude, longitude: location.longitude, area: location.area ?? "", city: location.city ?? "", district: location.district ?? "", state: location.state ?? "", postal_code: location.postal_code ?? "" })} />

      <form onSubmit={submitBooking} className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="min-w-0 space-y-5 rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-slab-ink">Equipment requirements</h2>
          <div className="rounded-md border border-slab-border bg-slate-50 p-4">
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-end">
              <label className="min-w-0 flex-1 text-sm font-semibold text-slab-ink">Project
                <select name="project_id" className="mt-2 min-h-11 w-full rounded-md border border-slab-border bg-white px-3" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                  <option value="">Select an active project</option>
                  {projects.filter((project) => project.status !== "completed").map((project) => <option key={project.id} value={project.id}>{project.project_name} · {project.address?.city || project.address?.line1}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" onClick={() => setShowProjectForm(true)}><Plus size={16} /> Create project</Button>
            </div>
            {!projects.filter((project) => project.status !== "completed").length ? <p className="mt-2 text-sm text-slab-muted">Create a project here or continue without one if this is a one-off booking.</p> : null}
          </div>
          {showProjectForm ? (
            <section className="rounded-md border border-slab-border bg-white p-4 shadow-soft" aria-label="Create project">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slab-primaryStrong">New Project</p>
                  <h3 className="mt-1 text-xl font-black text-slab-ink">Create Project</h3>
                  <p className="mt-1 text-sm text-slab-muted">Save this site to your customer workspace and use it for this booking.</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setShowProjectForm(false)}>Cancel</Button>
              </div>
              <div ref={projectFormRef} className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slab-ink md:col-span-2">Project name *<input name="project_name" required minLength={1} maxLength={180} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" placeholder="Commercial site package" /></label>
                <label className="text-sm font-semibold text-slab-ink md:col-span-2">Site address *<input name="line1" required minLength={1} maxLength={240} defaultValue={site.line1 === "Unconfirmed site" ? "" : site.line1} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" placeholder="Full site address" /></label>
                <label className="text-sm font-semibold text-slab-ink">Area / Locality<input name="area" defaultValue={site.area} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">City<input name="city" defaultValue={site.city} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">District<input name="district" defaultValue={site.district} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">State<input name="state" defaultValue={site.state} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">PIN Code<input name="postal_code" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" defaultValue={site.postal_code} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" placeholder="680001" /></label>
                <label className="text-sm font-semibold text-slab-ink">Site contact name<input name="site_contact_name" className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">Site contact phone<input name="site_contact_phone" className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">Latitude *<input name="latitude" required type="number" step="any" defaultValue={site.latitude} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <label className="text-sm font-semibold text-slab-ink">Longitude *<input name="longitude" required type="number" step="any" defaultValue={site.longitude} className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" /></label>
                <textarea name="description" className="min-h-24 rounded-md border border-slab-border px-3 py-2 md:col-span-2" placeholder="Description / requirements" />
                <textarea name="requirements" className="min-h-24 rounded-md border border-slab-border px-3 py-2 md:col-span-2" placeholder="Site requirements" />
                <textarea name="note" className="min-h-20 rounded-md border border-slab-border px-3 py-2 md:col-span-2" placeholder="Notes" />
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <Button type="button" disabled={creatingProject} onClick={() => void createProject()}>{creatingProject ? "Creating..." : "Create Project"}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowProjectForm(false)}>Cancel</Button>
                </div>
              </div>
            </section>
          ) : null}
          {items.map((item, index) => (
            <div key={index} className="grid min-w-0 gap-3 rounded-md border border-slab-border bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[minmax(170px,1fr)_96px_minmax(170px,190px)_minmax(150px,170px)_48px]">
              <label className="text-sm font-semibold text-slab-ink">Equipment
                <select className="mt-2 min-h-11 w-full rounded-md border border-slab-border bg-white px-3" value={item.equipment_type} onChange={(event) => updateItem(index, { equipment_type: event.target.value })}>
                  {equipmentOptions.map((option) => <option key={option} value={option}>{equipmentLabels[option]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slab-ink">Quantity
                <input className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" type="number" min={1} max={20} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} />
              </label>
              <label className="text-sm font-semibold text-slab-ink">Estimated Duration
                <span className="mt-2 grid grid-cols-[1fr_auto] overflow-hidden rounded-md border border-slab-border bg-white">
                  <input className="min-h-11 min-w-0 border-0 px-3 outline-none" type="number" min={1} value={item.duration_hours} onChange={(event) => updateItem(index, { duration_hours: Number(event.target.value) })} />
                  <select className="min-h-11 border-l border-slab-border bg-slate-50 px-3 text-sm font-bold text-slab-ink" aria-label="Duration unit" defaultValue="hours">
                    <option value="hours">Hours</option>
                  </select>
                </span>
              </label>
              <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-slab-border bg-slate-50 px-3 text-sm font-semibold text-slab-ink lg:mt-7">
                <input type="checkbox" checked={item.operator_required} onChange={(event) => updateItem(index, { operator_required: event.target.checked })} />
                <span className="truncate">Operator Required</span>
              </label>
              <button type="button" title="Remove equipment" className="flex h-11 w-11 items-center justify-center rounded-md border border-slab-border bg-white shadow-[3px_3px_0_rgba(17,24,39,0.16)] transition hover:-translate-y-0.5 hover:border-slab-primaryStrong sm:justify-self-start lg:mt-7" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove equipment">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Button type="button" onClick={() => setItems([...items, { equipment_type: "standard_tipper", quantity: 1, duration_hours: scheduleDurationHours, operator_required: true }])}>
            <Plus size={16} /> Add equipment
          </Button>

          <div className="grid gap-4">
            <label className="text-sm font-semibold text-slab-ink">Start date & time<input className="mt-2 min-h-11 w-full rounded-md border border-slab-border px-3" name="starts_at" type="datetime-local" required /></label>
            <textarea className="min-h-28 rounded-md border border-slab-border px-3 py-2" name="requirements" placeholder={isEmergency ? "Short problem description, site access, contact number" : "Requirements, access notes, photos summary"} />
            <textarea className="min-h-24 rounded-md border border-slab-border px-3 py-2" name="notes" placeholder={isEmergency ? "Emergency notes for provider dispatch" : "Internal notes"} />
          </div>
        </div>

        <aside className="h-fit min-w-0 rounded-lg border border-slab-border bg-white p-6 shadow-soft xl:sticky xl:top-24">
          <h2 className="text-2xl font-black text-slab-ink">Booking summary</h2>
          <p className="mt-2 text-sm text-slab-muted">{totalQuantity} equipment units, {items.length} line items</p>
          <Button type="button" className="mt-5 w-full" onClick={() => void calculate()}><Calculator size={16} /> Estimate cost</Button>
          {estimate ? (
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="Equipment" value={formatINR(estimate.equipment_subtotal)} />
              <Row label="Travel" value={formatINR(estimate.travel_charge)} />
              {estimate.emergency_service_charge ? <Row label="Emergency service charge" value={formatINR(estimate.emergency_service_charge)} /> : null}
              <Row label={estimate.is_emergency ? "SLAB Emergency Booking Fee" : "SLAB fee"} value={formatINR(estimate.platform_fee)} />
              <Row label="Estimated total" value={formatINR(estimate.estimated_total)} strong />
            </dl>
          ) : null}
          <Button className="mt-6 w-full" type="submit">Review and book</Button>
        </aside>
      </form>
    </section>
  );

  function updateItem(index: number, patch: Partial<BookingItem>) {
    if (typeof patch.duration_hours === "number" && Number.isFinite(patch.duration_hours)) {
      setScheduleDurationHours(patch.duration_hours);
    }
    setItems(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-slab-border pt-3 text-lg font-black text-slab-ink" : "text-slab-muted"}`}>
      <dt>{label}</dt>
      <dd className="font-bold text-slab-ink">{value}</dd>
    </div>
  );
}

function formatINR(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

function estimatedEndFromStart(startsAt: string, durationHours: number) {
  if (!startsAt || !Number.isFinite(durationHours) || durationHours <= 0) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  return new Date(start.getTime() + durationHours * 60 * 60 * 1000).toISOString();
}

function normalizeDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function cleanSiteAddress(site: typeof initialSite) {
  const cleaned = Object.fromEntries(
    Object.entries(site).filter(([, value]) => value !== "" && value !== undefined && value !== null),
  ) as typeof site;
  return {
    line1: cleaned.line1 || "Selected site",
    latitude: cleaned.latitude,
    longitude: cleaned.longitude,
    area: cleaned.area,
    city: cleaned.city,
    district: cleaned.district,
    state: cleaned.state,
    postal_code: cleaned.postal_code,
  };
}
