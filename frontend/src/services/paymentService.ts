import { apiClient, request } from "../api/client";

export interface PaymentRecord { id: string; status: string; amount_cents: number; currency: string; stripe_payment_intent_id?: string | null; }

export const paymentService = {
  checkout: (bookingId: string, idempotencyKey?: string) =>
    request<{ checkout_url: string; payment_id: string }>(apiClient.post(`/payments/bookings/${bookingId}/checkout`, { idempotency_key: idempotencyKey })),
  get: (bookingId: string) => request<PaymentRecord | null>(apiClient.get(`/payments/bookings/${bookingId}`)),
  verification: (bookingId: string) => request<{ required: boolean; verified: boolean; expires_at?: string }>(apiClient.get(`/payments/bookings/${bookingId}/verification`)),
  presentationCode: (bookingId: string) => request<{ code?: string; verified?: boolean; expires_at?: string }>(apiClient.get(`/payments/bookings/${bookingId}/verification-code`)),
  verifyCode: (bookingId: string, pin: string) => request<{ verified: boolean }>(apiClient.post(`/payments/bookings/${bookingId}/verification`, { pin }))
};
