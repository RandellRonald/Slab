import { ArrowRight, Mail, MessageSquare, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { supportContacts, supportSections } from "../support/supportContent";

export function SupportPage() {
  const hasPhone = Boolean(supportContacts.phone);
  const hasEmail = Boolean(supportContacts.email);

  function openChat() {
    window.dispatchEvent(new Event("slab:open-chatbot"));
  }

  return (
    <section className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slab-primaryStrong">Contact & Support</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight text-slab-ink max-sm:text-4xl">We’re Here to Help.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slab-muted">Need help with booking, equipment, payments, tracking, or your project? Contact the SLAB support team.</p>
        </div>
        <div className="rounded-lg border-2 border-slab-ink bg-white p-5 shadow-[7px_7px_0_rgba(17,24,39,0.16)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slab-primaryStrong">Support Desk</p>
          <h2 className="mt-2 text-2xl font-black text-slab-ink">Fast help for active jobs.</h2>
          <p className="mt-2 text-sm leading-6 text-slab-muted">Use chat for common questions, or contact SLAB support when your booking needs direct help.</p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {supportSections.map(([title, copy], index) => (
          <article className="rounded-lg border border-slab-border bg-white p-5 shadow-soft" key={title}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slab-border bg-yellow-50 text-sm font-black text-slab-ink">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="mt-4 text-lg font-black text-slab-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slab-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <Phone className="text-slab-primaryStrong" />
          <h2 className="mt-4 text-xl font-black text-slab-ink">Call Support</h2>
          <p className="mt-2 text-sm text-slab-muted">{hasPhone ? supportContacts.phone : "Support phone to be configured."}</p>
          <Button className="mt-5 w-full" disabled={!hasPhone} onClick={() => { if (hasPhone) window.location.href = `tel:${supportContacts.phone}`; }}>Call Support</Button>
        </article>

        <article className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <Mail className="text-slab-primaryStrong" />
          <h2 className="mt-4 text-xl font-black text-slab-ink">Email Support</h2>
          <p className="mt-2 text-sm text-slab-muted">{hasEmail ? supportContacts.email : "Support email to be configured."}</p>
          <Button className="mt-5 w-full" variant="secondary" disabled={!hasEmail} onClick={() => { if (hasEmail) window.location.href = `mailto:${supportContacts.email}`; }}>Email Support</Button>
        </article>

        <article className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <MessageSquare className="text-slab-primaryStrong" />
          <h2 className="mt-4 text-xl font-black text-slab-ink">Chat with SLAB</h2>
          <p className="mt-2 text-sm text-slab-muted">Open the SLAB support assistant for booking, tracking, payment, emergency, and project questions.</p>
          <Button className="mt-5 w-full" onClick={openChat}>Chat with SLAB</Button>
        </article>
      </section>

      <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex gap-4">
            <ShieldCheck className="mt-1 shrink-0 text-slab-primaryStrong" />
            <div>
              <h2 className="text-2xl font-black text-slab-ink">Need to book now?</h2>
              <p className="mt-2 text-slab-muted">Start a normal or emergency request with your site location, equipment needs, and estimated duration.</p>
            </div>
          </div>
          <Link to="/booking"><Button>Start Booking <ArrowRight size={16} /></Button></Link>
        </div>
      </section>
    </section>
  );
}
