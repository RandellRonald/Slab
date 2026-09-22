import { apiClient, request } from "../api/client";
import type { Address, BookingItem, PricingEstimate } from "../types/phase2";

export interface ProjectInput {
  company_id?: string;
  project_name: string;
  address: Address;
  latitude: number;
  longitude: number;
  site_contact_name?: string;
  site_contact_phone?: string;
  description?: string;
  requirements?: string;
}

export interface ProjectUpdateInput extends Partial<Omit<ProjectInput, "company_id">> {}

export interface BookingInput {
  company_id?: string;
  project_id?: string;
  is_emergency?: boolean;
  site_location: Address;
  starts_at: string;
  ends_at: string;
  distance_km: number;
  items: BookingItem[];
  requirements?: string;
  notes?: string;
  photo_urls: string[];
}

export interface BookingExperience {
  booking: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  assignment?: Record<string, unknown> | null;
  provider?: Record<string, unknown> | null;
  equipment?: Record<string, unknown> | null;
  latest_location?: Record<string, unknown> | null;
  payment?: Record<string, unknown> | null;
  status_history: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  pin_required: boolean;
  pin_verified: boolean;
  job_pin?: string | null;
}

export const customerService = {
  listLocations: () => request<unknown[]>(apiClient.get("/customer/locations")),
  createLocation: (payload: { label: string; address: Address; is_default?: boolean }) =>
    request<unknown>(apiClient.post("/customer/locations", payload)),
  listCompanies: () => request<unknown[]>(apiClient.get("/customer/companies")),
  createCompany: (payload: { company_name: string; business_email?: string; business_phone?: string; address?: Address }) =>
    request<unknown>(apiClient.post("/customer/companies", payload)),
  listProjects: () => request<unknown[]>(apiClient.get("/customer/projects")),
  createProject: (payload: ProjectInput) => request<unknown>(apiClient.post("/customer/projects", payload)),
  getProject: (projectId: string) => request<Record<string, unknown>>(apiClient.get(`/customer/projects/${projectId}`)),
  updateProject: (projectId: string, payload: ProjectUpdateInput) => request<unknown>(apiClient.patch(`/customer/projects/${projectId}`, payload)),
  finishProject: (projectId: string) => request<unknown>(apiClient.post(`/customer/projects/${projectId}/finish`)),
  reopenProject: (projectId: string) => request<unknown>(apiClient.post(`/customer/projects/${projectId}/reopen`)),
  addProjectNote: (projectId: string, payload: { note: string; note_type: "note" | "issue" | "delay" | "danger" }) => request<unknown>(apiClient.post(`/customer/projects/${projectId}/notes`, payload)),
  listBookings: () => request<unknown[]>(apiClient.get("/customer/bookings")),
  getBooking: (bookingId: string) => request<Record<string, unknown>>(apiClient.get(`/customer/bookings/${bookingId}`)),
  getBookingExperience: (bookingId: string) => request<BookingExperience>(apiClient.get(`/customer/bookings/${bookingId}/experience`)),
  verifyBookingPin: (bookingId: string, pin: string) => request<{ verified: boolean }>(apiClient.post(`/customer/bookings/${bookingId}/verify-pin`, { pin })),
  estimateBooking: (payload: { items: BookingItem[]; distance_km: number; is_emergency?: boolean }) =>
    request<PricingEstimate>(apiClient.post("/customer/bookings/estimate", payload)),
  createBooking: (payload: BookingInput) => request<{ id: string; status: string }>(apiClient.post("/customer/bookings", payload)),
  cancelBooking: (bookingId: string, reason: string) =>
    request<unknown>(apiClient.post(`/customer/bookings/${bookingId}/cancel`, { reason }))
};

export const mapService = {
  search: (query: string) => request<unknown[]>(apiClient.post("/maps/search", { query, limit: 5 })),
  reverseGeocode: (latitude: number, longitude: number) =>
    request<unknown>(apiClient.post("/maps/reverse-geocode", { latitude, longitude })),
  route: (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) =>
    request<{ distance_km: number; duration_minutes: number; source: string; geometry?: unknown }>(
      apiClient.post("/maps/route", { origin, destination })
    )
};
