import { ArrowRight, CheckCircle2, CreditCard, Landmark, LoaderCircle, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient, request } from "../api/client";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { customerService, type BookingExperience } from "../services/customerService";
import { paymentService } from "../services/paymentService";

type PaymentMethod = "upi" | "net_banking" | "card";

const methods: { id: PaymentMethod; label: string; description: string; icon: typeof Smartphone }[] = [
  { id: "upi", label: "UPI / Google Pay", description: "Pay securely with your preferred UPI app", icon: Smartphone },
  { id: "net_banking", label: "Net Banking", description: "Continue with your bank", icon: Landmark },
  { id: "card", label: "Card", description: "Credit and debit cards accepted", icon: CreditCard }
];

export function MockPaymentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const [booking, setBooking] = useState<Record<string, any> | null>(null);
  const [experience, setExperience] = useState<BookingExperience | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<{ reference?: string; amount_cents?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    void Promise.all([
      customerService.getBooking(bookingId),
      paymentService.get(bookingId),
      customerService.getBookingExperience(bookingId).catch(() => null)
    ])
      .then(([loaded, payment, loadedExperience]) => {
        setBooking(loaded);
        setExperience(loadedExperience);
        if (payment?.status === "succeeded") {
          setPaid({ reference: payment.stripe_payment_intent_id ?? undefined, amount_cents: payment.amount_cents });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load booking."));
  }, [bookingId]);

  async function pay() {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await request<{ reference?: string; amount_cents?: number }>(
        apiClient.post(`/payments/bookings/${bookingId}/mock-pay`, { payment_method: method, idempotency_key: `presentation-${bookingId}` })
      );
      setPaid(result);
      const loadedExperience = await customerService.getBookingExperience(bookingId);
      setExperience(loadedExperience);
      setBooking((loadedExperience.booking as Record<string, any>) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!bookingId) return <ErrorState title="Booking reference missing" message="Return to the booking review and try again." />;
  if (paid) return <BookingConfirmation bookingId={bookingId} booking={booking} experience={experience} paid={paid} />;

  const snapshot = booking?.pricing_snapshot || {};
  const fee = Number(snapshot.platform_fee || 0);

  if (booking && fee === 0 && snapshot.is_emergency) {
    return (
      <section className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-sm font-bold uppercase text-slab-primaryStrong">Emergency booking</p>
          <h1 className="mt-2 text-3xl font-black text-slab-ink">No SLAB booking fee</h1>
          <p className="mt-2 text-slab-muted">SLAB Emergency Booking Fee is ₹0. Service and travel charges remain separate with the provider.</p>
        </div>
        {error ? <ErrorState title="Emergency confirmation failed" message={error} /> : null}
        <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
          <p className="font-bold text-slab-ink">Booking {bookingId.slice(0, 8)}</p>
          <p className="mt-2 text-sm text-slab-muted">{String(booking.status || "confirmed").replace(/_/g, " ")} · SLAB Emergency Booking Fee ₹0</p>
          <Button className="mt-6 w-full" type="button" onClick={() => void pay()} disabled={busy}>
            {busy ? <><LoaderCircle className="animate-spin" size={16} /> Confirming emergency request...</> : "Confirm emergency request"}
          </Button>
        </section>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm font-bold uppercase text-slab-primaryStrong">Secure payment</p>
        <h1 className="mt-2 text-3xl font-black text-slab-ink">Pay the SLAB platform fee</h1>
        <p className="mt-2 text-slab-muted">Choose a payment method to confirm this booking and start provider matching.</p>
      </div>
      {error ? <ErrorState title="Payment failed" message={error} /> : null}
      <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3 border-b border-slab-border pb-5">
          <CreditCard className="text-slab-primaryStrong" />
          <div>
            <p className="font-bold text-slab-ink">Booking {bookingId.slice(0, 8)}</p>
            <p className="text-sm text-slab-muted">{String(booking?.status || "payment_pending").replace(/_/g, " ")} · Platform fee ₹{fee.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {methods.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.id} type="button" onClick={() => setMethod(option.id)} className={`flex w-full items-center gap-4 rounded-md border p-4 text-left ${method === option.id ? "border-slab-primaryStrong bg-yellow-50" : "border-slab-border hover:bg-slate-50"}`}>
                <Icon className="text-slab-primaryStrong" size={22} />
                <span>
                  <span className="block font-bold text-slab-ink">{option.label}</span>
                  <span className="mt-1 block text-sm text-slab-muted">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Button className="mt-6 w-full" type="button" onClick={() => void pay()} disabled={busy || !booking}>
          {busy ? <><LoaderCircle className="animate-spin" size={16} /> Processing payment...</> : `Pay ₹${fee.toLocaleString("en-IN")}`}
        </Button>
      </section>
    </section>
  );
}

function BookingConfirmation({ bookingId, booking, experience, paid }: { bookingId: string; booking: Record<string, any> | null; experience: BookingExperience | null; paid: { reference?: string; amount_cents?: number } }) {
  const navigate = useNavigate();
  const bookingRecord = ((experience?.booking as Record<string, any> | undefined) ?? booking) || {};
  const items = useMemo(() => experience?.items ?? [], [experience?.items]);
  const provider = (experience?.provider as Record<string, any> | null | undefined) ?? null;
  const matching = experience?.matching_summary;
  const equipmentText = items.length ? items.map((item) => formatEquipment(String(item.equipment_type || "Equipment"))).join(", ") : "Selected equipment";
  const quantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0) || 1;
  const start = bookingRecord.starts_at ? formatDateTime(String(bookingRecord.starts_at)) : "Scheduled start";
  const durationHours = useMemo(() => getDurationHours(bookingRecord, items), [bookingRecord, items]);
  const eta = matching?.eta_minutes !== undefined && matching?.eta_minutes !== null ? `${Number(matching.eta_minutes).toLocaleString("en-IN")} min` : "Matching";
  const distanceValue = matching?.distance_km ?? bookingRecord.distance_km;
  const distance = distanceValue !== undefined && distanceValue !== null ? `${Number(distanceValue).toFixed(1)} km` : "Matching";
  const providerStatus = provider ? String(provider.business_name || provider.full_name || "Assigned provider") : formatStatus(String(matching?.status || bookingRecord.status || "matching"));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-slab-border bg-white p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-5 border-b border-slab-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slab-yellow text-slab-ink"><CheckCircle2 size={28} /></span>
              <div>
                <p className="text-sm font-bold uppercase text-slab-primaryStrong">Booking confirmed</p>
                <h1 className="text-3xl font-black text-slab-ink">Booking Confirmed ✓</h1>
              </div>
            </div>
            <p className="mt-4 text-slab-muted">Share this PIN with your provider when they arrive.</p>
          </div>
          <div className="rounded-md border border-slab-ink bg-slab-yellow px-5 py-4 text-center shadow-neo">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slab-ink">Job PIN</p>
            <p className="mt-1 text-3xl font-black text-slab-ink">{experience?.job_pin || "Pending"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Equipment" value={equipmentText} />
          <Detail label="Quantity" value={String(quantity)} />
          <Detail label="Start" value={start} />
          <Detail label="Estimated Duration" value={`${durationHours} hours`} />
          <Detail label="Estimated Arrival" value={eta} />
          <Detail label="Distance" value={distance} />
          <Detail label="Provider" value={providerStatus} />
          <Detail label="Amount paid to SLAB" value={`₹${((paid.amount_cents || 0) / 100).toLocaleString("en-IN")}`} />
        </div>

        <div className="mt-6 border-t border-slab-border pt-5">
          <p className="text-sm text-slab-muted">Reference</p>
          <p className="mt-1 break-all font-bold text-slab-ink">{paid.reference || `booking-${bookingId.slice(0, 8)}`}</p>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" type="button" onClick={() => navigate("/customer/workspace")}>View Booking</Button>
          <Button type="button" onClick={() => navigate(`/booking/tracking?booking_id=${bookingId}`)}>Track Your Job <ArrowRight size={16} /></Button>
        </div>
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slab-border bg-slab-surface p-4">
      <p className="text-sm text-slab-muted">{label}</p>
      <p className="mt-1 font-black text-slab-ink">{value}</p>
    </div>
  );
}

function formatEquipment(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function getDurationHours(booking: Record<string, any>, items: Array<Record<string, unknown>>) {
  if (booking.starts_at && booking.ends_at) {
    const hours = (new Date(String(booking.ends_at)).getTime() - new Date(String(booking.starts_at)).getTime()) / 36e5;
    if (Number.isFinite(hours) && hours > 0) return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  }
  const itemDuration = items[0]?.duration_hours;
  return itemDuration !== undefined && itemDuration !== null ? String(itemDuration) : "8";
}
