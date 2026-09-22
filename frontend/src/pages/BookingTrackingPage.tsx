import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { Clock, LoaderCircle, MapPin, MessageSquare, Phone, Route, Star } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { env } from "../config/env";
import { BookingExperience, customerService, mapService } from "../services/customerService";

const OSM_STYLE = {
  version: 8 as const,
  sources: { osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", minzoom: 0, maxzoom: 19 }],
};

const STATUS_STEPS = ["matching", "assigned", "provider_en_route", "provider_arrived", "in_progress", "completed"];

export function BookingTrackingPage() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const siteMarker = useRef<maplibregl.Marker | null>(null);
  const providerMarker = useRef<maplibregl.Marker | null>(null);
  const reconnectAttempt = useRef(0);
  const [experience, setExperience] = useState<BookingExperience | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance_km: number; duration_minutes: number; source: string } | null>(null);
  const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number; heading?: number; timestamp?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState("connecting");

  const booking = experience?.booking ?? {};
  const site = (booking.site_location ?? {}) as Record<string, unknown>;
  const provider = experience?.provider ?? null;
  const equipment = experience?.equipment ?? null;
  const jobPin = experience?.job_pin ?? null;
  const siteCoordinate = useMemo(() => coordinate(site.latitude, site.longitude), [site.latitude, site.longitude]);
  const initialProviderCoordinate = useMemo(() => {
    const latest = experience?.latest_location;
    return coordinate(latest?.latitude, latest?.longitude) || coordinate(provider?.latitude, provider?.longitude);
  }, [experience?.latest_location, provider?.latitude, provider?.longitude]);
  const currentProviderCoordinate = providerLocation ?? initialProviderCoordinate;

  const load = useCallback(async () => {
    if (!bookingId) return;
    const data = await customerService.getBookingExperience(bookingId);
    setExperience(data);
    const latest = data.latest_location;
    const nextProvider = coordinate(latest?.latitude, latest?.longitude) || coordinate(data.provider?.latitude, data.provider?.longitude);
    if (nextProvider) setProviderLocation({ ...nextProvider, timestamp: String(latest?.recorded_at ?? "") });
    setError(null);
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    async function run() {
      try {
        await load();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load live tracking.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [bookingId, load]);

  useEffect(() => {
    if (!bookingId) return;
    let socket: WebSocket | null = null;
    let closed = false;
    let reconnectTimer = 0;
    function connect() {
      const token = localStorage.getItem("slab_access_token");
      if (!token) return;
      setSocketState("connecting");
      socket = new WebSocket(`${env.wsUrl}/ws/tracking/${bookingId}?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        reconnectAttempt.current = 0;
        setSocketState("connected");
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.refetch) void load();
        if (message.type === "tracking_update") setProviderLocation({ latitude: Number(message.lat), longitude: Number(message.lng), heading: Number(message.heading || 0), timestamp: String(message.timestamp || "") });
      };
      socket.onerror = () => setSocketState("reconnecting");
      socket.onclose = () => {
        if (closed) return;
        setSocketState("reconnecting");
        const wait = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectAttempt.current += 1;
        reconnectTimer = window.setTimeout(connect, wait);
      };
    }
    connect();
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [bookingId, load]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current || !siteCoordinate) return;
    const map = new maplibregl.Map({ container: mapNode.current, style: OSM_STYLE, center: [siteCoordinate.longitude, siteCoordinate.latitude], zoom: 12 });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.on("error", () => setError("Map tiles could not be loaded. Check the network and retry."));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [loading, siteCoordinate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !siteCoordinate) return;
    if (!siteMarker.current) siteMarker.current = new maplibregl.Marker({ color: "#111111" }).setPopup(new maplibregl.Popup().setText("Job site"));
    siteMarker.current.setLngLat([siteCoordinate.longitude, siteCoordinate.latitude]);
    if (!siteMarker.current.getElement().parentElement) siteMarker.current.addTo(map);
  }, [siteCoordinate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentProviderCoordinate) return;
    if (!providerMarker.current) providerMarker.current = new maplibregl.Marker({ color: "#f5c400" }).setPopup(new maplibregl.Popup().setText("Provider"));
    providerMarker.current.setLngLat([currentProviderCoordinate.longitude, currentProviderCoordinate.latitude]);
    if (!providerMarker.current.getElement().parentElement) providerMarker.current.addTo(map);
    if (siteCoordinate) {
      const bounds = new maplibregl.LngLatBounds([siteCoordinate.longitude, siteCoordinate.latitude], [siteCoordinate.longitude, siteCoordinate.latitude]);
      bounds.extend([currentProviderCoordinate.longitude, currentProviderCoordinate.latitude]);
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 700 });
    }
  }, [currentProviderCoordinate, siteCoordinate]);

  useEffect(() => {
    const sitePoint = siteCoordinate;
    const providerCoordinate = currentProviderCoordinate;
    if (!sitePoint || !providerCoordinate) return;
    const routeOrigin: { latitude: number; longitude: number } = providerCoordinate;
    const routeDestination: { latitude: number; longitude: number } = sitePoint;
    let cancelled = false;
    async function drawRoute() {
      const route = await mapService.route(routeOrigin, routeDestination);
      if (cancelled) return;
      setRouteInfo(route);
      const liveMap = mapRef.current;
      if (!liveMap) return;
      const geometry = route.geometry as { type: "LineString"; coordinates: number[][] } | undefined;
      if (!geometry) return;
      const data = { type: "Feature" as const, properties: {}, geometry };
      const applyRoute = () => {
        if (cancelled) return;
        const source = liveMap.getSource("route") as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data);
        else {
          liveMap.addSource("route", { type: "geojson", data });
          liveMap.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#f5c400", "line-width": 5, "line-opacity": 0.85 } });
        }
      }
      if (liveMap.loaded()) applyRoute();
      else liveMap.once("load", applyRoute);
    }
    void drawRoute();
    return () => {
      cancelled = true;
    };
  }, [currentProviderCoordinate, siteCoordinate]);

  if (!bookingId) return <ErrorState title="Booking reference missing" message="Return to booking and try again." />;
  if (loading) return <LoadingState label="Loading live tracking" />;

  const status = String(booking.status ?? "matching");
  const lastUpdated = providerLocation?.timestamp ? new Date(providerLocation.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Waiting for GPS";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase text-slab-primaryStrong">Live dispatch</p>
        <h1 className="mt-2 text-3xl font-black text-slab-ink">{statusLabel(status)}</h1>
        <p className="mt-2 text-slab-muted">ETA and route are refreshed from SLAB tracking services.</p>
      </div>
      {error ? <ErrorState title="Tracking needs attention" message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-lg border border-slab-border bg-white shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slab-border p-4">
            <div className="flex items-center gap-3">
              <Route className="text-slab-primaryStrong" />
              <div>
                <p className="font-bold text-slab-ink">Booking {bookingId.slice(0, 8)}</p>
                <p className="text-sm text-slab-muted">{String(site.line1 ?? site.address ?? "Confirmed job site")}</p>
              </div>
            </div>
            <p className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold capitalize text-slab-ink">{socketState}</p>
          </div>
          <div className="relative h-[520px] bg-slate-100">
            <div ref={mapNode} className="h-full w-full" />
            {!siteCoordinate ? <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-sm font-semibold text-slab-error">Site coordinates are missing for this booking.</div> : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slab-primaryStrong bg-yellow-50 p-5 shadow-soft">
            <p className="text-sm font-bold uppercase text-slab-primaryStrong">Job start PIN</p>
            <p className="mt-3 text-3xl font-black tracking-[0.24em] text-slab-ink">{jobPin || "------"}</p>
            <p className="mt-3 text-sm leading-6 text-slab-muted">Give this PIN to the provider only when they have arrived at your site.</p>
          </section>
          <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
            <p className="text-sm font-bold uppercase text-slab-primaryStrong">Provider</p>
            <div className="mt-4 flex gap-3">
              {provider?.profile_photo_url ? <img className="h-14 w-14 rounded-full object-cover" src={String(provider.profile_photo_url)} alt="Provider" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slab-yellow text-xl font-black text-slab-ink">{String(provider?.company_name ?? "S").slice(0, 1)}</div>}
              <div>
                <h2 className="font-black text-slab-ink">{String(provider?.company_name ?? "Provider matching")}</h2>
                <p className="text-sm text-slab-muted">{String(equipment?.display_name ?? "Equipment assignment pending")}</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slab-ink"><Star size={14} className="fill-slab-yellow text-slab-primaryStrong" /> {Number(provider?.rating_average ?? 0).toFixed(1)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary"><Phone size={16} /> Call</Button>
              <Button type="button" variant="secondary"><MessageSquare size={16} /> Chat</Button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Metric icon={<Clock />} label="ETA" value={routeInfo ? `${routeInfo.duration_minutes} min` : "Calculating"} />
            <Metric icon={<MapPin />} label="Distance" value={routeInfo ? `${routeInfo.distance_km} km` : "Calculating"} />
          </section>

          <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
            <h2 className="font-black text-slab-ink">Booking progress</h2>
            <div className="mt-4 space-y-3">
              {STATUS_STEPS.map((step) => (
                <div key={step} className="flex items-center gap-3 text-sm">
                  <span className={`h-3 w-3 rounded-full ${STATUS_STEPS.indexOf(step) <= STATUS_STEPS.indexOf(status) ? "bg-slab-yellow" : "bg-slate-200"}`} />
                  <span className="font-semibold capitalize text-slab-ink">{step.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
            <h2 className="font-black text-slab-ink">Tracking signal</h2>
            <p className="mt-2 text-sm text-slab-muted">Last update: {lastUpdated}</p>
            <p className="mt-1 text-sm text-slab-muted">Heading: {providerLocation?.heading ? `${Math.round(providerLocation.heading)}°` : "Awaiting provider GPS"}</p>
            {socketState !== "connected" ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slab-muted"><LoaderCircle className="animate-spin" size={15} /> Reconnecting and refetching latest state</p> : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function coordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

function statusLabel(status: string) {
  if (status === "provider_en_route") return "Provider is on the way";
  if (status === "provider_arrived") return "Provider arrived";
  if (status === "in_progress") return "Job in progress";
  if (status === "completed") return "Job completed";
  if (status === "assigned") return "Provider assigned";
  return "Provider matching in progress";
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slab-border bg-white p-4 shadow-soft">
      <div className="text-slab-primaryStrong">{icon}</div>
      <p className="mt-2 text-sm font-semibold text-slab-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-slab-ink">{value}</p>
    </article>
  );
}
