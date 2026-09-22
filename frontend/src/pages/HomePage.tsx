import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, Clock, IndianRupee, MessageSquare, Navigation, ShieldCheck, Star } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { lazy, ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import jcbMapMarker from "../assets/slab-jcb-map-marker.png";
import { Button } from "../components/ui/Button";
import { EquipmentCategoryCard, type EquipmentCategory } from "../components/landing/EquipmentCategoryCard";
import "../components/landing/landing-sections.css";

const HeroScene = lazy(() => import("../components/landing/HeroScene").then((module) => ({ default: module.HeroScene })));

const categories: EquipmentCategory[] = [
  { number: "01", eyebrow: "Earthmoving", title: "Excavators", description: "Ground-breaking reach for foundations, trenching, and precision earthwork.", capability: "Operator-ready", availability: "Live availability", marketplaceCategory: "excavators", visual: "excavator" },
  { number: "02", eyebrow: "Utility work", title: "JCB / Backhoe", description: "A versatile site partner for digging, loading, and clean, efficient prep.", capability: "Verified equipment", availability: "Flexible hire", marketplaceCategory: "jcb-backhoe", visual: "jcb" },
  { number: "03", eyebrow: "Heavy lifting", title: "Cranes", description: "Certified lifting capacity for structural work, placement, and commercial builds.", capability: "Safety-checked", availability: "Planned dispatch", marketplaceCategory: "cranes", visual: "crane" },
  { number: "04", eyebrow: "Site logistics", title: "Tippers", description: "Reliable hauling for sand, soil, aggregate, construction debris, and site material movement.", capability: "Route-ready", availability: "Tracked arrival", marketplaceCategory: "tippers", visual: "tipper" },
  { number: "05", eyebrow: "Site sanitation", title: "Septic Tank Services", description: "Cleaning, desludging, sewage removal, and emergency septic support for Kerala sites.", capability: "Verified service", availability: "Emergency ready", marketplaceCategory: "septic-tank-services", visual: "septic" }
];

const faqs = [
  ["Can I book multiple machines for one project?", "Yes. SLAB supports project-level bookings for multiple equipment types, schedules, and site requirements."],
  ["Are SLAB providers verified?", "Yes. Provider verification is part of the SLAB onboarding process before providers can receive eligible work."],
  ["How does SLAB track equipment?", "SLAB uses live location, route, distance, and ETA information to help customers follow equipment movement."],
  ["Are the prices fixed?", "Displayed estimates are based on the selected equipment, duration, location, and applicable charges. The final amount can vary based on the booking details."]
];

const LANDING_OSM_STYLE = {
  version: 8 as const,
  sources: { osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", minzoom: 0, maxzoom: 19 }],
};

const liveTrackingRoute: [number, number][] = [
  [76.2868, 9.994],
  [76.2935, 9.9885],
  [76.3012, 9.9828],
  [76.31, 9.9768],
  [76.3187, 9.9699],
];

const liveTrackingProviderCoordinate = liveTrackingRoute[0];
const liveTrackingJobSiteCoordinate = liveTrackingRoute[liveTrackingRoute.length - 1];
const fallbackRouteInfo = { distance_km: 18.4, duration_minutes: 28, source: "presentation" };

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    const sectionId = location.hash.slice(1);
    if (!sectionId) return;
    const timeout = window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    return () => window.clearTimeout(timeout);
  }, [location.hash]);

  return (
    <section className="space-y-20">
      <Suspense fallback={<section aria-label="Loading equipment" className="min-h-[580px]" />}>
        <HeroScene />
      </Suspense>

      <LiveTrackingShowcase />

      <div id="equipment-search" className="rounded-lg border border-slab-border bg-white p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <input className="min-h-12 rounded-md border border-slab-border px-4" placeholder="Search excavators, JCBs, cranes, tippers, septic services" />
          <input className="min-h-12 rounded-md border border-slab-border px-4" placeholder="Location" />
          <input className="min-h-12 rounded-md border border-slab-border px-4" type="date" />
          <Link to="/booking" className="flex">
            <Button className="w-full">Start Booking</Button>
          </Link>
        </div>
      </div>

      <section id="equipment-categories">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-slab-primaryStrong">Equipment categories</p>
            <h2 className="mt-2 text-3xl font-black text-slab-ink">Specific machines, real providers, and job-ready booking.</h2>
          </div>
          <Link to="/equipment/excavators"><Button variant="secondary">Browse equipment</Button></Link>
        </div>
        <div className="slab-category-grid">
          {categories.map((category) => (
            <EquipmentCategoryCard category={category} key={category.title} />
          ))}
        </div>
      </section>

      <section id="how-it-works" className="slab-process" aria-labelledby="process-title">
        <header className="slab-process__heading">
          <p>How it works</p>
          <h2 id="process-title">From Search to Site, Without the Guesswork<span>.</span></h2>
          <span>Choose your equipment, get matched with a verified provider, and track the job from request to arrival.</span>
        </header>
        <div className="slab-process__grid">
          <article className="slab-process__card slab-process__card--customer">
            <div className="slab-process__number">01</div>
            <div className="slab-process__copy"><p>Customer</p><span>Find the equipment you need. Choose your machine, location, date, and requirements.</span></div>
            <ul><li><BadgeCheck size={15} /> Search equipment</li><li><BadgeCheck size={15} /> Add location and date</li><li><BadgeCheck size={15} /> Share job requirements</li></ul>
            <Link to="/booking"><Button>Find equipment <ArrowRight size={16} /></Button></Link>
          </article>
          <article className="slab-process__card slab-process__card--slab">
            <div className="slab-process__number">02</div>
            <div className="slab-process__copy"><p>SLAB</p><span>We find the right match. SLAB checks availability, pricing, distance, and verified providers.</span></div>
            <div className="slab-process__dashboard" aria-label="SLAB equipment matching interface">
              <div className="slab-process__dashboard-top"><b>SLAB.</b><span>Matching providers</span></div>
              <div className="slab-process__dashboard-search">Ernakulam <span>Equipment search</span></div>
              <div className="slab-process__dashboard-map" aria-hidden="true"><i /><i /><i /><b>3 nearby</b><span>Verified</span></div>
              <div className="slab-process__dashboard-row"><span>JCB Backhoe</span><b>Available</b></div>
              <div className="slab-process__dashboard-row"><span>Mobile Crane</span><b>Available</b></div>
              <div className="slab-process__dashboard-row"><span>Standard Tipper</span><b>Available</b></div>
              <div className="slab-process__dashboard-stats"><span><b>12</b> providers found</span><span><b>₹8,500</b> estimate</span><span><b>18 min</b> nearest</span></div>
            </div>
            <div className="slab-process__route"><b>Request<br />received</b><i /><b>Matching<br />providers</b><i /><b>Provider<br />confirmed</b><i /><b>Equipment<br />dispatched</b></div>
          </article>
          <article className="slab-process__card slab-process__card--provider">
            <div className="slab-process__number">03</div>
            <div className="slab-process__copy"><p>Verified provider</p><span>Equipment comes to your site. The provider accepts the job, travels to your location, and gets to work.</span></div>
            <ul><li><BadgeCheck size={15} /> Accept the job</li><li><BadgeCheck size={15} /> Travel to your site</li><li><BadgeCheck size={15} /> Start the work</li></ul>
            <Link to="/provider/register"><Button>Become a provider <ArrowRight size={16} /></Button></Link>
          </article>
        </div>
        <div className="slab-process__benefits"><span><BadgeCheck size={20} /><b>500+</b> Verified providers</span><span><Building2 size={20} /><b>Transparent pricing</b> No hidden costs</span><span><Clock size={20} /><b>Faster completion</b> Right machine, right time</span><span><MessageSquare size={20} /><b>Dedicated support</b> With you at every step</span></div>
      </section>

      <section id="for-providers" className="slab-experience" aria-labelledby="slab-experience-title">
        <header className="slab-experience__header">
          <p>SLAB Experience</p>
          <h2 id="slab-experience-title">Built Around How You Work</h2>
          <span>Simple tools for customers and providers, from first request to completed work.</span>
        </header>

        <div className="slab-experience__grid">
          <article className="slab-experience__panel slab-experience__panel--customer">
            <div className="slab-experience__copy">
              <span className="slab-experience__tag">Customer side</span>
              <h3>Customer Experience</h3>
              <p>Guided booking, location intelligence, pricing and real-time job visibility.</p>
            </div>
            <div className="slab-experience__features" aria-label="Customer experience features">
              <ExperienceFeature number="01" title="Guided Booking" copy="Choose equipment, service, date, duration and site." />
              <ExperienceFeature number="02" title="Smart Location" copy="Search, GPS, distance and ETA." />
              <ExperienceFeature number="03" title="Clear Pricing" copy="Backend-calculated booking estimates." />
              <ExperienceFeature number="04" title="Work History" copy="Active, upcoming and completed work." />
            </div>
            <ExperienceProductVisual
              label="Booking"
              title="Site equipment request"
              rows={[
                ["Equipment", "JCB / Backhoe"],
                ["Location", "Ernakulam"],
                ["Date", "Tomorrow"],
                ["Estimate", "₹8,500"]
              ]}
              action="Book"
              Icon={CalendarDays}
            />
            <Link className="slab-experience__cta" to="/customer">Open Customer Workspace <ArrowRight size={17} /></Link>
          </article>

          <article className="slab-experience__panel slab-experience__panel--provider">
            <div className="slab-experience__copy">
              <span className="slab-experience__tag">Provider side</span>
              <h3>Provider Experience</h3>
              <p>A streamlined workflow from incoming request to completed job.</p>
            </div>
            <div className="slab-experience__features" aria-label="Provider experience features">
              <ExperienceFeature number="01" title="Incoming Requests" copy="Receive jobs with complete project context." />
              <ExperienceFeature number="02" title="Smart Dispatch" copy="See location, distance and job information." />
              <ExperienceFeature number="03" title="Job Control" copy="Accept, navigate, verify and start work." />
              <ExperienceFeature number="04" title="Completion" copy="Complete work, view estimate and update status." />
            </div>
            <ExperienceProductVisual
              label="New Request"
              title="Ready for dispatch"
              rows={[
                ["Equipment", "Standard Tipper"],
                ["Location", "Kochi site"],
                ["ETA", "18 min"],
                ["Status", "Accept"]
              ]}
              action="Accept"
              Icon={Navigation}
            />
            <Link className="slab-experience__cta" to="/provider">Open Provider Workspace <ArrowRight size={17} /></Link>
          </article>
        </div>

        <div className="slab-experience__trust" aria-label="SLAB value strip">
          <span><ShieldCheck size={19} /><b>Verified Providers</b></span>
          <span><IndianRupee size={19} /><b>Clear Estimates</b></span>
          <span><BadgeCheck size={19} /><b>Smart Matching</b></span>
          <span><Clock size={19} /><b>Real-Time Updates</b></span>
        </div>
      </section>

      <section className="slab-bulk-booking" aria-labelledby="slab-bulk-title">
        <div className="slab-bulk-booking__copy">
          <p>Project & Bulk Bookings</p>
          <h2 id="slab-bulk-title">Built for Bigger Sites and Bigger Requirements.</h2>
          <span>Plan multiple machines, providers, schedules, and site requirements through one organized SLAB booking.</span>
          <Link className="slab-bulk-booking__cta" to="/booking">Plan a Bulk Booking <ArrowRight size={17} /></Link>
        </div>

        <div className="slab-bulk-booking__summary" aria-label="Bulk equipment booking summary">
          <div className="slab-bulk-booking__summary-top">
            <span>Booking Summary</span>
            <b>6 machines</b>
          </div>
          {[
            ["2", "Excavators", "Earthmoving"],
            ["1", "JCB / Backhoe", "Utility work"],
            ["1", "Crane", "Heavy lifting"],
            ["2", "Tippers", "Site logistics"]
          ].map(([quantity, machine, label]) => (
            <div className="slab-bulk-booking__equipment" key={machine}>
              <strong>{quantity} ×</strong>
              <div>
                <b>{machine}</b>
                <span>{label}</span>
              </div>
              <i>Ready</i>
            </div>
          ))}
        </div>

        <div className="slab-bulk-booking__features" aria-label="Bulk booking benefits">
          <article>
            <span>01</span>
            <b>Verified Providers</b>
            <p>Trusted professionals for every machine.</p>
          </article>
          <article>
            <span>02</span>
            <b>Clear Coordination</b>
            <p>One place for schedules, requirements, and site details.</p>
          </article>
          <article>
            <span>03</span>
            <b>Built for Scale</b>
            <p>Manage multiple machines and providers within one project.</p>
          </article>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <p className="text-lg font-semibold text-slab-ink">"SLAB gives our team one place to find equipment, plan site requirements, and keep every job organized."</p>
          <p className="mt-4 text-sm font-bold text-slab-muted">Operations Team<br />Commercial Construction</p>
        </div>
        <div className="space-y-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-lg border border-slab-border bg-white p-5 shadow-soft">
              <summary className="cursor-pointer font-bold text-slab-ink">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-slab-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slab-border bg-white p-8 shadow-soft">
        <p className="text-sm font-black uppercase text-slab-primaryStrong">Ready for dispatch</p>
        <h2 className="mt-2 text-4xl font-black text-slab-ink">Move the next job with SLAB.</h2>
        <p className="mt-3 max-w-2xl text-slab-muted">Book equipment, manage projects, and match verified providers through a marketplace designed for construction work.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/booking"><Button>Book Equipment</Button></Link>
          <Link to="/provider/register"><Button variant="secondary">Become a Provider</Button></Link>
        </div>
      </section>

      <footer id="about" className="flex flex-col justify-between gap-4 border-t border-slab-border py-8 text-sm text-slab-muted sm:flex-row">
        <strong className="text-slab-ink">SLAB</strong>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>Equipment access built for real job sites.</span>
          <Link className="font-semibold text-slab-ink hover:text-slab-primaryStrong" to="/admin/login">Admin sign in</Link>
        </div>
      </footer>
    </section>
  );
}

function LiveTrackingShowcase() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const providerMarker = useRef<maplibregl.Marker | null>(null);
  const siteMarker = useRef<maplibregl.Marker | null>(null);
  const animationFrame = useRef(0);
  const routeCoordinates = useRef<[number, number][]>(liveTrackingRoute);
  const markerHeading = useRef(routeBearing(liveTrackingRoute, 0));
  const userMovedMap = useRef(false);
  const [tracking, setTracking] = useState({ distanceKm: fallbackRouteInfo.distance_km, etaMinutes: fallbackRouteInfo.duration_minutes, progress: 0 });

  const providerCoordinate = useMemo(() => liveTrackingProviderCoordinate, []);
  const siteCoordinate = useMemo(() => liveTrackingJobSiteCoordinate, []);

  const fitTrackingBounds = useCallback((duration = 800) => {
    const map = mapRef.current;
    const route = routeCoordinates.current;
    if (!map || route.length < 2) return;
    const bounds = route.reduce((nextBounds, point) => nextBounds.extend(point), new maplibregl.LngLatBounds(route[0], route[0]));
    map.fitBounds(bounds, { duration, maxZoom: 13.4, padding: { top: 90, right: 88, bottom: 120, left: 88 } });
  }, []);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let cancelled = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
      attributionControl: false,
      center: [76.303, 9.982],
      container: mapNode.current,
      interactive: true,
      pitch: 44,
      style: LANDING_OSM_STYLE,
      zoom: 12.3,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const providerElement = equipmentMarkerElement();
    const siteElement = siteMarkerElement();
    const equipmentMarkers = [
      markerElement("JCB", "slab-live-map__marker slab-live-map__marker--nearby"),
      markerElement("Crane", "slab-live-map__marker slab-live-map__marker--nearby"),
      markerElement("Tipper", "slab-live-map__marker slab-live-map__marker--nearby"),
    ];

    providerMarker.current = new maplibregl.Marker({ element: providerElement, pitchAlignment: "viewport", rotationAlignment: "map" }).setLngLat(providerCoordinate).addTo(map);
    siteMarker.current = new maplibregl.Marker({ element: siteElement, pitchAlignment: "viewport" }).setLngLat(siteCoordinate).addTo(map);
    const nearbyMarkers = [
      new maplibregl.Marker({ element: equipmentMarkers[0] }).setLngLat([76.296, 9.975]).addTo(map),
      new maplibregl.Marker({ element: equipmentMarkers[1] }).setLngLat([76.315, 9.989]).addTo(map),
      new maplibregl.Marker({ element: equipmentMarkers[2] }).setLngLat([76.282, 9.981]).addTo(map),
    ];

    map.on("dragstart", () => { userMovedMap.current = true; });
    map.on("zoomstart", () => { userMovedMap.current = true; });

    const setRouteData = (coordinates: [number, number][], progress = 0) => {
      const fullRoute = routeFeature(coordinates);
      const completedRoute = routeFeature(sliceRoute(coordinates, progress));
      const remainingRoute = routeFeature(remainingRouteSlice(coordinates, progress));
      const fullSource = map.getSource("landing-route") as maplibregl.GeoJSONSource | undefined;
      const completedSource = map.getSource("landing-completed-route") as maplibregl.GeoJSONSource | undefined;
      const remainingSource = map.getSource("landing-remaining-route") as maplibregl.GeoJSONSource | undefined;
      if (fullSource) fullSource.setData(fullRoute);
      else {
        map.addSource("landing-route", { type: "geojson", data: fullRoute });
        map.addSource("landing-completed-route", { type: "geojson", data: completedRoute });
        map.addSource("landing-remaining-route", { type: "geojson", data: remainingRoute });
        map.addLayer({
          id: "landing-route-glow",
          type: "line",
          source: "landing-route",
          paint: { "line-color": "#111111", "line-opacity": 0.16, "line-width": 11 },
        });
        map.addLayer({
          id: "landing-route-completed",
          type: "line",
          source: "landing-completed-route",
          paint: { "line-color": "#5e5544", "line-opacity": 0.42, "line-width": 4 },
        });
        map.addLayer({
          id: "landing-route-remaining",
          type: "line",
          source: "landing-remaining-route",
          paint: { "line-color": "#d99b00", "line-opacity": 0.98, "line-width": 5.5 },
        });
      }
      if (completedSource) completedSource.setData(completedRoute);
      if (remainingSource) remainingSource.setData(remainingRoute);
    };

    const loadRoute = async () => {
      const nextRoute = normalizeRouteEndpoints(liveTrackingRoute, providerCoordinate, siteCoordinate);
      const nextInfo = fallbackRouteInfo;
      if (cancelled) return;
      routeCoordinates.current = nextRoute;
      markerHeading.current = routeBearing(nextRoute, 0);
      setTracking({ distanceKm: Number(nextInfo.distance_km.toFixed(1)), etaMinutes: Math.round(nextInfo.duration_minutes), progress: 0 });
      providerMarker.current?.setLngLat(nextRoute[0]).setRotation(markerHeading.current);
      siteMarker.current?.setLngLat(nextRoute[nextRoute.length - 1]);
      setRouteData(nextRoute, 0);
      fitTrackingBounds(900);
      if (reduceMotion) {
        setRouteData(nextRoute, 0);
        return;
      }
      const startedAt = performance.now();
      const driveDuration = 18000;
      const arrivalPause = 3000;
      const totalRouteKm = routeLengthKm(nextRoute);
      const animate = (now: number) => {
        if (cancelled) return;
        const cycleElapsed = (now - startedAt) % (driveDuration + arrivalPause);
        const progress = cycleElapsed >= driveDuration ? 1 : cycleElapsed / driveDuration;
        const position = interpolateRoute(nextRoute, progress);
        const nextHeading = routeBearing(nextRoute, progress);
        markerHeading.current = smoothHeading(markerHeading.current, nextHeading, 0.16);
        providerMarker.current?.setLngLat(position).setRotation(markerHeading.current);
        setRouteData(nextRoute, progress);
        const remainingRatio = Math.max(0, 1 - progress);
        const routeDistance = totalRouteKm > 0 ? totalRouteKm * remainingRatio : nextInfo.distance_km * remainingRatio;
        const remainingDistance = Math.max(0, routeDistance);
        const remainingEta = Math.max(0, Math.ceil(nextInfo.duration_minutes * remainingRatio));
        setTracking({ distanceKm: Number(remainingDistance.toFixed(1)), etaMinutes: remainingEta, progress });
        if (!userMovedMap.current && progress > 0.18 && progress < 0.86) {
          map.easeTo({ center: position, duration: 900, zoom: Math.max(map.getZoom(), 12.4) });
        }
        animationFrame.current = window.requestAnimationFrame(animate);
      };
      animationFrame.current = window.requestAnimationFrame(animate);
    };

    const onLoad = () => { void loadRoute(); };
    if (map.loaded()) onLoad();
    else map.once("load", onLoad);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame.current);
      providerMarker.current?.remove();
      siteMarker.current?.remove();
      nearbyMarkers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
      providerMarker.current = null;
      siteMarker.current = null;
    };
  }, [fitTrackingBounds, providerCoordinate, siteCoordinate]);

  return (
    <section id="live-tracking" className="slab-live-tracking" aria-labelledby="slab-live-tracking-title">
      <div className="slab-live-tracking__copy">
        <p>Live Tracking</p>
        <h2 id="slab-live-tracking-title">Know Where Your Equipment Is.</h2>
        <span>Track your provider, route, and arrival in real time.</span>
      </div>
      <div className="slab-live-tracking__product">
        <div className="slab-live-map" aria-label="SLAB live tracking map preview">
          <div ref={mapNode} className="slab-live-map__canvas" />
          <div className="slab-live-map__scrim" aria-hidden="true" />
          <div className="slab-live-map__badge">
            <span>SLAB Live</span>
            <b>JCB / Backhoe</b>
            <small>Provider nearby</small>
          </div>
          <div className="slab-live-map__eta">
            <span>{tracking.distanceKm.toFixed(1)} km</span>
            <b>{tracking.etaMinutes > 0 ? `${tracking.etaMinutes} min ETA` : "Arrived"}</b>
          </div>
          <div className="slab-live-map__status">
            <p>Live Tracking</p>
            <h3>Provider en route</h3>
            <dl>
              <div><dt>Equipment</dt><dd>JCB / Backhoe</dd></div>
              <div><dt>Area</dt><dd>Kochi</dd></div>
              <div><dt>ETA</dt><dd>{tracking.etaMinutes > 0 ? `${tracking.etaMinutes} min` : "Arrived"}</dd></div>
              <div><dt>Distance</dt><dd>{tracking.distanceKm.toFixed(1)} km</dd></div>
            </dl>
            <strong>{tracking.progress >= 1 ? "ARRIVED" : "ON THE WAY"}</strong>
          </div>
          <div className="slab-live-map__verified"><ShieldCheck size={16} /> Verified Provider</div>
          <button className="slab-live-map__recenter" type="button" onClick={() => { userMovedMap.current = false; fitTrackingBounds(650); }}>Recenter</button>
        </div>
      </div>
    </section>
  );
}

function markerElement(label: string, className: string) {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("aria-label", label);
  element.innerHTML = `<span>${label}</span>`;
  return element;
}

function equipmentMarkerElement() {
  const element = document.createElement("div");
  element.className = "slab-live-equipment-marker";
  element.setAttribute("aria-label", "JCB provider");
  element.innerHTML = `<span class="slab-live-equipment-marker__pulse"></span><img alt="" src="${jcbMapMarker}" />`;
  return element;
}

function siteMarkerElement() {
  const element = document.createElement("div");
  element.className = "slab-live-site-marker";
  element.setAttribute("aria-label", "Job site");
  element.innerHTML = `<span class="slab-live-site-marker__pin"><i></i></span><b>JOB SITE</b>`;
  return element;
}

function routeFeature(coordinates: [number, number][]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } };
}

function normalizeRouteEndpoints(coordinates: [number, number][], origin: [number, number], destination: [number, number]) {
  const middle = coordinates.filter((coordinate) => isFiniteCoordinate(coordinate));
  const route = [...middle];
  if (!sameCoordinate(route[0], origin)) route.unshift(origin);
  else route[0] = origin;
  if (!sameCoordinate(route[route.length - 1], destination)) route.push(destination);
  else route[route.length - 1] = destination;
  return dedupeAdjacentCoordinates(route);
}

function isFiniteCoordinate(coordinate: [number, number]) {
  return Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]);
}

function sameCoordinate(a: [number, number] | undefined, b: [number, number]) {
  return !!a && Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;
}

function dedupeAdjacentCoordinates(coordinates: [number, number][]) {
  return coordinates.filter((coordinate, index) => index === 0 || !sameCoordinate(coordinates[index - 1], coordinate));
}

function interpolateRoute(coordinates: [number, number][], progress: number): [number, number] {
  if (coordinates.length < 2) return coordinates[0];
  if (progress >= 1) return coordinates[coordinates.length - 1];
  const targetDistance = routeLengthKm(coordinates) * Math.max(0, progress);
  const { start, end, local } = routeSegmentAtDistance(coordinates, targetDistance);
  return [start[0] + (end[0] - start[0]) * local, start[1] + (end[1] - start[1]) * local];
}

function sliceRoute(coordinates: [number, number][], progress: number) {
  if (progress >= 1) return coordinates;
  const targetDistance = routeLengthKm(coordinates) * Math.max(0, progress);
  const { index } = routeSegmentAtDistance(coordinates, targetDistance);
  return [...coordinates.slice(0, index + 1), interpolateRoute(coordinates, progress)];
}

function remainingRouteSlice(coordinates: [number, number][], progress: number) {
  if (progress >= 1) return [coordinates[coordinates.length - 1], coordinates[coordinates.length - 1]];
  const targetDistance = routeLengthKm(coordinates) * Math.max(0, progress);
  const { index } = routeSegmentAtDistance(coordinates, targetDistance);
  return [interpolateRoute(coordinates, progress), ...coordinates.slice(index + 1)];
}

function routeBearing(coordinates: [number, number][], progress: number) {
  const targetDistance = routeLengthKm(coordinates) * Math.min(0.999, Math.max(0, progress));
  const { start, end } = routeSegmentAtDistance(coordinates, targetDistance);
  const y = Math.sin((end[0] - start[0]) * Math.PI / 180) * Math.cos(end[1] * Math.PI / 180);
  const x = Math.cos(start[1] * Math.PI / 180) * Math.sin(end[1] * Math.PI / 180) - Math.sin(start[1] * Math.PI / 180) * Math.cos(end[1] * Math.PI / 180) * Math.cos((end[0] - start[0]) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function routeSegmentAtDistance(coordinates: [number, number][], targetDistanceKm: number) {
  let travelled = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segmentDistance = haversineKm(start, end);
    if (travelled + segmentDistance >= targetDistanceKm) {
      const local = segmentDistance === 0 ? 0 : (targetDistanceKm - travelled) / segmentDistance;
      return { index, start, end, local: Math.min(1, Math.max(0, local)) };
    }
    travelled += segmentDistance;
  }
  const index = Math.max(0, coordinates.length - 2);
  return { index, start: coordinates[index], end: coordinates[coordinates.length - 1], local: 1 };
}

function smoothHeading(current: number, target: number, strength: number) {
  const delta = ((((target - current) % 360) + 540) % 360) - 180;
  return (current + delta * strength + 360) % 360;
}

function routeLengthKm(coordinates: [number, number][]) {
  return coordinates.reduce((distance, point, index) => {
    if (index === 0) return 0;
    return distance + haversineKm(coordinates[index - 1], point);
  }, 0);
}

function haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const radiusKm = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ExperienceFeature({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="slab-experience__feature">
      <span>{number}</span>
      <div>
        <b>{title}</b>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function ExperienceProductVisual({ label, title, rows, action, Icon }: { label: string; title: string; rows: [string, string][]; action: string; Icon: typeof CalendarDays }) {
  return (
    <div className="slab-experience__visual" aria-label={`SLAB ${label.toLowerCase()} interface`}>
      <div className="slab-experience__visual-top">
        <span>{label}</span>
        <i />
      </div>
      <div className="slab-experience__visual-title">
        <Icon size={22} />
        <b>{title}</b>
      </div>
      <div className="slab-experience__visual-rows">
        {rows.map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      <button type="button">{action} <ArrowRight size={15} /></button>
    </div>
  );
}

function TrustCard({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <article className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
      <div className="text-slab-primaryStrong">{icon}</div>
      <h3 className="mt-4 text-xl font-black text-slab-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slab-muted">{copy}</p>
    </article>
  );
}
