import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { paymentService } from "../services/paymentService";

export function BookingPaymentPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const bookingId = params.get("booking_id");
  const cancelled = location.pathname.endsWith("cancelled");
  const [payment, setPayment] = useState<{ status: string; amount_cents: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || cancelled) return;
    void paymentService.get(bookingId).then(setPayment).catch((err) => setError(err instanceof Error ? err.message : "Unable to load payment status."));
  }, [bookingId, cancelled]);

  async function retry() {
    if (!bookingId) return;
    try { const result = await paymentService.checkout(bookingId); window.location.assign(result.checkout_url); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to restart checkout."); }
  }

  if (!bookingId) return <ErrorState title="Booking reference missing" message="Return to your bookings and try again." />;
  if (error) return <ErrorState title="Payment status unavailable" message={error} />;
  if (cancelled) return <Status icon={<XCircle />} title="Payment cancelled" body="Your booking is still waiting for the SLAB booking fee." action={<Button onClick={() => void retry()}><RotateCcw size={16} /> Try again</Button>} />;
  if (!payment) return <div className="flex items-center gap-3 text-slab-muted"><LoaderCircle className="animate-spin" /> Checking payment status...</div>;
  if (payment.status === "succeeded") return <Status icon={<CheckCircle2 />} title="Booking fee paid" body="Your booking is confirmed and provider matching has started." action={<Link to="/customer"><Button>View bookings</Button></Link>} />;
  return <Status icon={<LoaderCircle className="animate-spin" />} title="Payment processing" body="Stripe is verifying your payment. Refresh this page in a moment." action={<Button variant="secondary" onClick={() => window.location.reload()}>Refresh</Button>} />;
}

function Status({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action: ReactNode }) {
  return <section className="mx-auto max-w-xl rounded-lg border border-slab-border bg-white p-8 text-center shadow-soft"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slab-yellow text-slab-ink">{icon}</div><h1 className="mt-5 text-3xl font-black text-slab-ink">{title}</h1><p className="mt-3 text-slab-muted">{body}</p><div className="mt-6 flex justify-center">{action}</div></section>;
}
