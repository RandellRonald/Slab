import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { mapService } from "../../services/customerService";
import { Button } from "../ui/Button";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  postal_code?: string;
}

type NominatimAddress = Record<string, string>;
type SearchResult = { display_name: string; lat: string; lon: string; address?: NominatimAddress };
type ReverseResult = {
  display_name?: string;
  address?: string | NominatimAddress;
  area_locality?: string;
  city?: string;
  district?: string;
  state?: string;
  postal_code?: string;
};

const INDIA_CENTER = { latitude: 10.5276, longitude: 76.2144 };
const OSM_STYLE = {
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

export function LocationPicker({ onConfirm }: { onConfirm: (location: PickedLocation) => void }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const reverseRequestRef = useRef(0);

  const [center, setCenter] = useState(INDIA_CENTER);
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("Move the map or search for an Indian site address.");
  const [fields, setFields] = useState({ area: "", city: "", district: "", state: "", postal_code: "" });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapNode.current,
      style: OSM_STYLE,
      center: [INDIA_CENTER.longitude, INDIA_CENTER.latitude],
      zoom: 6,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.on("moveend", () => {
      const c = map.getCenter();
      setCenter({ latitude: Number(c.lat.toFixed(6)), longitude: Number(c.lng.toFixed(6)) });
    });
    map.on("error", () => setError("Map tiles could not be loaded. You can still enter the address manually."));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = window.setTimeout(() => void reverse(center.latitude, center.longitude), 650);
    return () => window.clearTimeout(timer);
  }, [center.latitude, center.longitude]);

  function moveTo(latitude: number, longitude: number, zoom = 15) {
    const next = { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
    setCenter(next);
    mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom });
  }

  function applyAddress(result: ReverseResult, latitude: number, longitude: number) {
    const structured = typeof result.address === "object" && result.address ? result.address : {};
    const textAddress = typeof result.address === "string" ? result.address : "";
    const display = result.display_name || textAddress || [structured.house_number, structured.road].filter(Boolean).join(" ") || `${latitude}, ${longitude}`;
    const postal = normalizePin(result.postal_code || structured.postcode || "");

    setAddress(display);
    setFields({
      area: result.area_locality || structured.suburb || structured.neighbourhood || structured.village || structured.hamlet || "",
      city: result.city || structured.city || structured.town || structured.municipality || structured.city_district || "",
      district: result.district || structured.county || structured.district || "",
      state: result.state || structured.state || "",
      postal_code: postal,
    });
  }

  async function search() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      setResults((await mapService.search(`${query}, India`)) as SearchResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Address search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function selectResult(result: SearchResult) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    setResults([]);
    moveTo(latitude, longitude);
    await reverse(latitude, longitude);
  }

  async function reverse(latitude: number, longitude: number) {
    const requestId = reverseRequestRef.current + 1;
    reverseRequestRef.current = requestId;
    setReverseLoading(true);
    setError(null);

    try {
      const result = (await mapService.reverseGeocode(latitude, longitude)) as ReverseResult;
      if (requestId !== reverseRequestRef.current) return;
      applyAddress(result, latitude, longitude);
    } catch {
      if (requestId !== reverseRequestRef.current) return;
      setError("Address lookup failed. You can enter the address and PIN Code manually or move the map to retry.");
    } finally {
      if (requestId === reverseRequestRef.current) setReverseLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("GPS is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        moveTo(latitude, longitude);
        setError(null);
        void reverse(latitude, longitude);
      },
      () => setError("GPS permission was denied. Search or pan the map to choose a location."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function updateField(name: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [name]: name === "postal_code" ? normalizePin(value) : value }));
  }

  const validPin = /^[1-9][0-9]{5}$/.test(fields.postal_code);

  function confirm() {
    if (!validPin) {
      setError("PIN Code must be exactly 6 digits and cannot start with 0.");
      return;
    }
    onConfirm({ ...center, address, ...fields });
  }

  return (
    <div className="rounded-lg border border-slab-border bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 text-slab-muted" size={16} />
          <input
            className="min-h-11 w-full rounded-md border border-slab-border pl-10 pr-3 text-sm"
            placeholder="Search site address in India"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => void search()} disabled={searching}>
          <Search size={16} /> {searching ? "Searching" : "Search"}
        </Button>
        <Button type="button" variant="secondary" onClick={useCurrentLocation}>
          <Navigation size={16} /> GPS
        </Button>
      </div>

      {results.length ? (
        <div className="mb-3 space-y-2 rounded-md border border-slab-border p-2">
          {results.map((result) => (
            <button
              type="button"
              key={`${result.lat}-${result.lon}`}
              className="block w-full rounded p-2 text-left text-sm hover:bg-slate-50"
              onClick={() => void selectResult(result)}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative h-[360px] overflow-hidden rounded-md border border-slab-border bg-slate-100">
        <div ref={mapNode} className="h-full w-full" />
        <MapPin className="pointer-events-none absolute left-1/2 top-1/2 -ml-4 -mt-8 text-slab-primaryStrong drop-shadow" size={34} />
        {reverseLoading ? (
          <div className="absolute left-3 top-3 rounded-md border border-slab-border bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slab-ink shadow-soft">
            Finding address
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input className="min-h-11 w-full rounded-md border border-slab-border px-3 sm:col-span-2" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" />
        <input className="min-h-11 rounded-md border border-slab-border px-3" value={fields.area} onChange={(event) => updateField("area", event.target.value)} placeholder="Area / Locality" />
        <input className="min-h-11 rounded-md border border-slab-border px-3" value={fields.city} onChange={(event) => updateField("city", event.target.value)} placeholder="City" />
        <input className="min-h-11 rounded-md border border-slab-border px-3" value={fields.district} onChange={(event) => updateField("district", event.target.value)} placeholder="District" />
        <input className="min-h-11 rounded-md border border-slab-border px-3" value={fields.state} onChange={(event) => updateField("state", event.target.value)} placeholder="State" />
        <label className="text-sm font-semibold text-slab-ink sm:col-span-2">
          PIN Code
          <input
            className={`mt-1 min-h-11 w-full rounded-md border px-3 font-normal ${fields.postal_code && !validPin ? "border-red-400" : "border-slab-border"}`}
            inputMode="numeric"
            maxLength={6}
            value={fields.postal_code}
            onChange={(event) => updateField("postal_code", event.target.value)}
            placeholder="680001"
            required
          />
          {fields.postal_code && !validPin ? <span className="font-normal text-slab-error">Enter 6 digits; first digit cannot be 0.</span> : null}
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slab-muted">
          <p className="font-semibold text-slab-ink">{reverseLoading ? "Finding address..." : address}</p>
          <p>
            {center.latitude}, {center.longitude}
          </p>
          {error ? <p className="mt-1 text-slab-error">{error}</p> : null}
        </div>
        <Button type="button" onClick={confirm} disabled={reverseLoading}>
          Confirm location
        </Button>
      </div>
    </div>
  );
}

function normalizePin(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return digits.length === 6 ? digits : digits;
}
