import { BadgeCheck, ChevronLeft, Clock3, MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Button } from "../components/ui/Button";
import { marketplaceService, type MarketplaceEquipment } from "../services/marketplaceService";

const categoryDetails: Record<string, { title: string; detail: string }> = {
  "excavators": { title: "Excavator providers", detail: "Verified earthmoving equipment for excavation, trenching, and foundation work." },
  "jcb-backhoe": { title: "JCB / Backhoe providers", detail: "Versatile equipment and experienced operators for active sites." },
  "cranes": { title: "Crane providers", detail: "Verified lifting equipment for planned structural and commercial work." },
  "tippers": { title: "Tipper providers", detail: "Reliable hauling for sand, soil, aggregate, construction debris, and site material movement." },
  "septic-tank-services": { title: "Septic Tank Services", detail: "Verified cleaning, desludging, sewage removal, and emergency septic providers across Kerala." }
};

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function MarketplaceEquipmentPage() {
  const { category = "" } = useParams();
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const details = category ? categoryDetails[category] : { title: "Equipment marketplace", detail: "Browse verified equipment and service providers across Kerala." };
  const [equipment, setEquipment] = useState<MarketplaceEquipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category && !categoryDetails[category]) return;
    setLoading(true);
    marketplaceService.listEquipment(category || undefined)
      .then(setEquipment)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the equipment marketplace."))
      .finally(() => setLoading(false));
  }, [category]);

  const visibleEquipment = useMemo(() => equipment.filter((item) => {
    if (!searchTerm) return true;
    return [item.slug, item.name, item.category, ...item.providers.map((provider) => provider.company_name || provider.name)].join(" ").toLowerCase().includes(searchTerm);
  }), [equipment, searchTerm]);
  const providerCount = useMemo(() => visibleEquipment.reduce((total, item) => total + item.providers.length, 0), [visibleEquipment]);

  if (!details) {
    return <ErrorState title="Equipment category not found" message="Return to the marketplace to browse available equipment." />;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slab-muted hover:text-slab-ink" to="/#equipment-categories">
        <ChevronLeft size={17} /> Back to categories
      </Link>
      <header className="flex flex-col gap-4 border-b border-slab-border pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-slab-primaryStrong">SLAB marketplace</p>
          <h1 className="mt-2 text-3xl font-black text-slab-ink sm:text-4xl">{details.title}</h1>
          <p className="mt-3 max-w-2xl text-slab-muted">{details.detail}</p>
        </div>
        {!loading ? <p className="text-sm font-semibold text-slab-muted">{providerCount} verified provider{providerCount === 1 ? "" : "s"} available</p> : null}
      </header>

      {loading ? <LoadingState label="Loading available equipment" /> : null}
      {error ? <ErrorState title="Marketplace unavailable" message={error} /> : null}
      {!loading && !error && visibleEquipment.length === 0 ? <ErrorState title="No matching equipment" message="Try another equipment type or browse the full marketplace." /> : null}

      {!loading && !error ? <div className="grid gap-5 md:grid-cols-2">
        {visibleEquipment.map((item) => (
          <article className="rounded-xl border border-slab-border bg-white p-6 shadow-soft" key={item.slug}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slab-primaryStrong">{item.category}</p>
                <h2 className="mt-2 text-2xl font-black text-slab-ink">{item.name}</h2>
              </div>
              <BadgeCheck aria-label="Active listing" className="shrink-0 text-slab-primaryStrong" size={24} />
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-slab-muted">
              <span><strong className="text-slab-ink">{formatINR(item.hourly_rate)}</strong> / hour</span>
              <span><strong className="text-slab-ink">{formatINR(item.daily_rate)}</strong> / day</span>
              <span className="inline-flex items-center gap-1"><Clock3 size={15} /> Live availability</span>
            </div>
            <div className="mt-6 space-y-3 border-t border-slab-border pt-5">
              {item.providers.length ? item.providers.map((provider, index) => <div className="flex items-center justify-between gap-3" key={`${provider.id}-${index}`}>
                <div>
                  <p className="font-bold text-slab-ink">{provider.company_name || provider.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slab-muted"><MapPin size={14} /> Verified provider {provider.is_online ? "· Online" : "· Available"}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slab-ink"><Star className="fill-slab-primary text-slab-primary" size={15} /> {Number(provider.rating || 0).toFixed(1)}</span>
              </div>) : <p className="text-sm text-slab-muted">Availability is being refreshed. You can still request this equipment.</p>}
            </div>
            <Link className="mt-6 inline-flex" to={`/booking?equipment=${item.slug}${item.slug === "emergency_septic_service" ? "&emergency=1" : ""}`}><Button>{item.slug === "emergency_septic_service" ? "Book Emergency Service" : "Book this equipment"}</Button></Link>
          </article>
        ))}
      </div> : null}
    </section>
  );
}
