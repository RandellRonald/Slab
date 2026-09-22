import { ArrowRight, LogOut, Menu, Search, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { marketplaceService, type MarketplaceEquipment } from "../../services/marketplaceService";
import { Button } from "../ui/Button";

const landingLinks = [
  { label: "Home", to: "/", exact: true },
  { label: "Find Equipment", to: "/equipment" },
  { label: "How It Works", hash: "how-it-works" },
  { label: "For Providers", to: "/provider/register" },
  { label: "About", hash: "about" }
];

function isLandingHashActive(pathname: string, hash: string, target?: string) {
  return pathname === "/" && (hash === `#${target}` || (!hash && target === undefined));
}

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<MarketplaceEquipment[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const landingPage = location.pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!searchOpen) return;
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", escape);
    void marketplaceService.listEquipment()
      .then(setCatalog)
      .catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : "Unable to load equipment."));
    window.setTimeout(() => searchInput.current?.focus(), 0);
    return () => window.removeEventListener("keydown", escape);
  }, [searchOpen]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.slice(0, 8);
    return catalog.filter((item) => [item.name, item.category, ...item.providers.map((provider) => provider.company_name || provider.name)].join(" ").toLowerCase().includes(normalized)).slice(0, 8);
  }, [catalog, query]);

  function scrollToSection(sectionId: string) {
    if (location.pathname !== "/") {
      navigate(`/#${sectionId}`);
      return;
    }
    window.history.replaceState(null, "", `/#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openSearch() {
    setCatalogError(null);
    setSearchOpen(true);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    setSearchOpen(false);
    navigate(`/equipment${normalized ? `?q=${encodeURIComponent(normalized)}` : ""}`);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setSearchOpen(false);
  }

  const navClass = (active: boolean) => `slab-nav-link border-b-2 py-2 text-[13px] font-semibold transition ${active ? "border-slab-primary text-slab-ink" : "border-transparent text-slab-muted hover:border-slab-primary hover:text-slab-ink"}`;

  return (
    <header className="slab-header sticky top-0 z-40 border-b border-slab-border bg-white/95 backdrop-blur-sm">
      <div className={`mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 ${landingPage ? "h-[76px]" : "h-16"}`}>
        <Link aria-label="SLAB home" to="/" className="slab-brand text-xl font-black tracking-normal text-slab-ink">SLAB<span aria-hidden="true">.</span></Link>
        <nav aria-label="Landing page" className="hidden items-center gap-6 min-[900px]:flex">
          {landingLinks.map((item) => item.hash ? (
            <button key={item.label} className={navClass(isLandingHashActive(location.pathname, location.hash, item.hash))} onClick={() => scrollToSection(item.hash!)} type="button">{item.label}</button>
          ) : (
            <NavLink key={item.label} end={item.exact} className={({ isActive }) => navClass(isActive && (item.exact || location.pathname.startsWith(item.to!)))} to={item.to!}>{item.label}</NavLink>
          ))}
        </nav>
        <nav aria-label="Account actions" className="hidden items-center gap-2 text-sm sm:flex">
          <button aria-label="Search equipment" className="rounded-md p-2 text-slab-muted transition hover:bg-slate-50 hover:text-slab-ink" onClick={openSearch} type="button"><Search size={19} /></button>
          {user ? <><NavLink className="px-3 py-2 font-medium text-slab-muted hover:text-slab-ink" to="/dashboard">Dashboard</NavLink><Button variant="secondary" onClick={() => void logout()}><LogOut size={16} />Logout</Button></> : <><NavLink className="px-3 py-2 font-medium text-slab-muted hover:text-slab-ink" to="/login">Sign In</NavLink><Link to="/equipment"><Button>Get Started</Button></Link></>}
        </nav>
        <button aria-expanded={menuOpen} aria-label={menuOpen ? "Close navigation" : "Open navigation"} className="rounded-md p-2 text-slab-ink sm:hidden" onClick={() => setMenuOpen((open) => !open)} type="button">{menuOpen ? <X /> : <Menu />}</button>
      </div>

      {menuOpen ? <div className="border-t border-slab-border bg-white px-4 py-4 shadow-soft sm:hidden">
        <nav aria-label="Mobile navigation" className="grid gap-1">
          {landingLinks.map((item) => item.hash ? <button className="rounded-md px-3 py-3 text-left font-semibold text-slab-ink hover:bg-slate-50" key={item.label} onClick={() => scrollToSection(item.hash!)} type="button">{item.label}</button> : <Link className="rounded-md px-3 py-3 font-semibold text-slab-ink hover:bg-slate-50" key={item.label} to={item.to!}>{item.label}</Link>)}
          <button className="flex items-center gap-2 rounded-md px-3 py-3 text-left font-semibold text-slab-ink hover:bg-slate-50" onClick={() => { setMenuOpen(false); openSearch(); }} type="button"><Search size={17} />Search equipment</button>
          {user ? <><Link className="rounded-md px-3 py-3 font-semibold text-slab-ink hover:bg-slate-50" to="/dashboard">Dashboard</Link><button className="rounded-md px-3 py-3 text-left font-semibold text-slab-ink hover:bg-slate-50" onClick={() => void logout()} type="button">Log out</button></> : <><Link className="rounded-md px-3 py-3 font-semibold text-slab-ink hover:bg-slate-50" to="/login">Sign In</Link><Link className="mt-2" to="/equipment"><Button className="w-full">Get Started</Button></Link></>}
        </nav>
      </div> : null}

      {searchOpen ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/25 p-4 pt-20" onMouseDown={() => setSearchOpen(false)} role="dialog">
        <section className="w-full max-w-2xl rounded-lg border border-slab-border bg-white p-5 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase text-slab-primaryStrong">SLAB marketplace</p><h2 className="mt-1 text-xl font-black text-slab-ink">Find equipment and services</h2></div><button aria-label="Close equipment search" className="rounded-md p-2 text-slab-muted hover:bg-slate-50" onClick={() => setSearchOpen(false)} type="button"><X size={20} /></button></div>
          <form className="mt-5 flex gap-2" onSubmit={submitSearch}><input className="min-w-0 flex-1 rounded-md border border-slab-border px-3 py-3" onChange={(event) => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="JCB, excavator, crane, septic tank..." ref={searchInput} value={query} /><Button aria-label="Submit equipment search" type="submit"><Search size={17} /></Button></form>
          <div className="mt-4 max-h-[50vh] overflow-y-auto"><p className="mb-2 text-xs font-bold uppercase text-slab-muted">{query.trim() ? "Matching equipment" : "Available equipment"}</p>{catalogError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{catalogError}</p> : results.length ? <div className="grid gap-2">{results.map((item) => <Link className="flex items-center justify-between gap-3 rounded-md border border-slab-border p-3 transition hover:border-slab-primary hover:bg-yellow-50" key={item.slug} onClick={() => setSearchOpen(false)} to={`/equipment?q=${encodeURIComponent(item.slug)}`}><span><b className="block text-slab-ink">{item.name}</b><small className="text-slab-muted">{item.category}</small></span><ArrowRight className="text-slab-primaryStrong" size={17} /></Link>)}</div> : <p className="py-6 text-center text-sm text-slab-muted">No equipment matches that search.</p>}</div>
        </section>
      </div> : null}
    </header>
  );
}
