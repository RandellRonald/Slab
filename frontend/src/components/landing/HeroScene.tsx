import { ArrowRight, CheckCircle2, ChevronRight, Clock3, MapPin, Play, Search, ShieldCheck, Star } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import campaignScene from "../../assets/slab-hero-campaign.png";
import equipmentCutout from "../../assets/slab-hero-equipment-cutout.png";
import "./hero-visual.css";

gsap.registerPlugin(ScrollTrigger);

const categoryLinks = [
  ["Excavators", "excavators"], ["JCB / Backhoe", "jcb-backhoe"], ["Cranes", "cranes"], ["Tippers", "tippers"], ["Septic Services", "septic-tank-services"]
];

const trustStats: Array<{ value: string; label: string; Icon: typeof ShieldCheck }> = [
  { value: "500+", label: "Verified Providers", Icon: ShieldCheck },
  { value: "All Kerala", label: "Our Focus", Icon: MapPin },
  { value: "60 Sec", label: "Quick Booking", Icon: Clock3 },
  { value: "4.8", label: "Average Rating", Icon: Star }
];

export function HeroScene() {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("excavators");

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline
          .from("[data-cinematic-copy]", { opacity: 0, y: 22, duration: 0.72, stagger: 0.09 })
          .from("[data-scene-background]", { opacity: 0, scale: 1.04, duration: 1.1 }, 0.08)
          .from("[data-scene-truck]", { opacity: 0, x: 28, duration: 0.95 }, 0.24)
          .from("[data-scene-excavator]", { opacity: 0, x: 46, y: 12, duration: 1.08 }, 0.34)
          .from("[data-scene-foreground]", { opacity: 0, y: 22, duration: 0.75 }, 0.52)
          .from("[data-trust-stat]", { opacity: 0, y: 12, duration: 0.45, stagger: 0.08 }, 0.62);

        gsap.to("[data-scene-excavator]", {
          yPercent: -4,
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.8 }
        });
        gsap.to("[data-scene-background]", {
          yPercent: 5,
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 1.1 }
        });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  useEffect(() => {
    const element = scene.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const handleMove = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      element.style.setProperty("--pointer-x", `${x}px`);
      element.style.setProperty("--pointer-y", `${y}px`);
    };
    const reset = () => { element.style.setProperty("--pointer-x", "0px"); element.style.setProperty("--pointer-y", "0px"); };
    element.addEventListener("pointermove", handleMove);
    element.addEventListener("pointerleave", reset);
    return () => { element.removeEventListener("pointermove", handleMove); element.removeEventListener("pointerleave", reset); };
  }, []);

  function searchEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/equipment/${category}${location.trim() ? `?location=${encodeURIComponent(location.trim())}` : ""}`);
  }

  return (
    <section className="slab-cinematic-hero" ref={root} aria-labelledby="hero-title">
      <div className="slab-cinematic-hero__scene" ref={scene}>
        <div aria-hidden="true" className="slab-cinematic-hero__background" data-scene-background><img alt="" src={campaignScene} /></div>
        <div aria-hidden="true" className="slab-cinematic-hero__truck" data-scene-truck><img alt="" src={equipmentCutout} /></div>
        <div aria-hidden="true" className="slab-cinematic-hero__excavator" data-scene-excavator><img alt="" src={equipmentCutout} /></div>
        <div aria-hidden="true" className="slab-cinematic-hero__dust"><i /><i /><i /><i /></div>
        <div aria-hidden="true" className="slab-cinematic-hero__foreground" data-scene-foreground />

        <div className="slab-cinematic-hero__content">
          <p className="slab-cinematic-hero__eyebrow" data-cinematic-copy>Equipment. People. Possibilities.</p>
          <h1 id="hero-title" data-cinematic-copy>Construction Equipment,<br />{"When\u00A0Needed"}<span>.</span></h1>
          <p className="slab-cinematic-hero__headline-support" data-cinematic-copy>Construction equipment, when you need it.</p>
          <p className="slab-cinematic-hero__description" data-cinematic-copy>From the first dig to the final load. Find the right equipment and trusted providers for your next job.</p>

          <form className="slab-cinematic-hero__search" data-cinematic-copy onSubmit={searchEquipment}>
            <label><MapPin aria-hidden="true" size={18} /><span><b>Enter location</b><input aria-label="Enter location" onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Ernakulam" value={location} /></span></label>
            <label><Search aria-hidden="true" size={17} /><span><b>What equipment?</b><select aria-label="Equipment category" onChange={(event) => setCategory(event.target.value)} value={category}><option value="excavators">JCB, excavator, tipper</option><option value="jcb-backhoe">JCB / Backhoe</option><option value="cranes">Crane</option><option value="tippers">Tipper</option><option value="septic-tank-services">Septic service</option></select></span></label>
            <button aria-label="Search equipment" type="submit"><ArrowRight size={20} /></button>
          </form>
          <div className="slab-cinematic-hero__chips" data-cinematic-copy>
            {categoryLinks.map(([name, route]) => <Link key={route} to={`/equipment/${route}`}>{name}</Link>)}
            <Link to="/equipment/excavators">View All <ChevronRight size={14} /></Link>
          </div>
          <div className="slab-cinematic-hero__assurance" data-cinematic-copy><span><ShieldCheck size={19} /> Verified<br />Providers</span><span><Clock3 size={19} /> Clear<br />Estimates</span><span><CheckCircle2 size={19} /> Dedicated<br />Support</span></div>
        </div>

        <div className="slab-cinematic-hero__editorial" aria-hidden="true"><p>Same<br />Ground.<br />A Brighter<br />Tomorrow.</p><i /></div>
        <div className="slab-cinematic-hero__site-copy" aria-hidden="true">BUILD.<br />CONNECT.<br />GROW.<br />KERALA.</div>
        <Link className="slab-cinematic-hero__watch" to="/#how-it-works"><span><Play fill="currentColor" size={13} /></span><b>Watch</b><small>How It Works</small></Link>
        <nav aria-label="Hero progress" className="slab-cinematic-hero__progress"><Link to="/">01</Link><Link to="/#equipment-categories">02</Link><Link to="/#how-it-works">03</Link><Link to="/#for-providers">04</Link></nav>
      </div>

      <div className="slab-cinematic-hero__trust-strip" aria-label="SLAB trust indicators">
        <div className="slab-cinematic-hero__kerala"><span>●</span><p>Serving<br /><b>Kerala</b><br />First</p></div>
        {trustStats.map(({ value, label, Icon }) => <div className="slab-cinematic-hero__trust-stat" data-trust-stat key={label}><Icon size={18} /><p><strong>{value}</strong><span>{label}</span></p></div>)}
        <p className="slab-cinematic-hero__manifesto">From<br />Our Soil<br />To A Stronger<br />Tomorrow.</p>
      </div>
    </section>
  );
}
