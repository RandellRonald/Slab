import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";

export function BookingVerificationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = params.get("booking_id");
  useEffect(() => { if (bookingId) navigate(`/booking/tracking?booking_id=${bookingId}`, { replace: true }); }, [bookingId, navigate]);
  if (!bookingId) return <ErrorState title="Booking reference missing" message="Return to booking and try again." />;
  return <LoadingState label="Opening live tracking" />;
}
