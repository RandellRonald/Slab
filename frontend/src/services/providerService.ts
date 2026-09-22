import { apiClient, request } from "../api/client";

export interface ProviderRequest {
  id: string;
  booking_id: string;
  status: string;
  distance_km?: number;
  eta_minutes?: number;
  estimated_amount?: number;
  request_payload?: Record<string, unknown>;
  customer?: { full_name?: string | null; email?: string | null } | null;
  booking?: { site_location?: { line1?: string; latitude?: number; longitude?: number }; starts_at?: string; ends_at?: string } | null;
  items?: Array<{ equipment_type?: string; quantity?: number; duration_hours?: number }>;
  equipment?: { display_name?: string } | null;
}

export interface JobAssignment {
  id: string;
  booking_id: string;
  booking?: {
    status?: string;
    site_location?: {
      line1?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    };
    starts_at?: string;
    ends_at?: string;
    requirements?: string | null;
  } | null;
  items?: Array<{ equipment_type: string; quantity: number; duration_hours: number; operator_required: boolean }>;
  customer?: { phone?: string | null; email?: string | null; full_name?: string | null } | null;
  en_route_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  estimated_amount?: number;
  distance_km?: number;
  eta_minutes?: number;
}

export interface ProviderNotification {
  id: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
}

export interface ProviderDashboard {
  provider?: { is_online?: boolean; verification_status?: string };
  verification?: { status?: string; rejection_reason?: string | null } | null;
  equipment_count: number;
  primary_equipment?: { display_name?: string; registration_number?: string; daily_rate?: number; status?: string } | null;
  pending_requests: ProviderRequest[];
  instant_requests?: ProviderRequest[];
  scheduled_requests?: ProviderRequest[];
  scheduled_work?: JobAssignment[];
  active_jobs: JobAssignment[];
  completed_jobs: JobAssignment[];
  earnings: { currency: string; completed_jobs: number; estimated_total: number };
  notifications: ProviderNotification[];
}

export interface ProviderEquipmentInput {
  equipment_type_slug: string;
  display_name: string;
  registration_number?: string;
  identification_number?: string;
  status: "available" | "unavailable" | "maintenance";
  hourly_rate?: number;
  daily_rate?: number;
  monthly_rate?: number;
  operating_latitude?: number;
  operating_longitude?: number;
  operating_radius_km: number;
  photo_urls: string[];
  document_urls: string[];
}

export const providerService = {
  dashboard: () => request<ProviderDashboard>(apiClient.get("/provider/dashboard")),
  updateStatus: (is_online: boolean) => request(apiClient.put("/provider/status", { is_online })),
  submitVerification: (payload: unknown) => request(apiClient.post("/provider/verification", payload)),
  listDocuments: () => request<unknown[]>(apiClient.get("/provider/documents")),
  createDocument: (payload: unknown) => request(apiClient.post("/provider/documents", payload)),
  listEquipment: () => request<unknown[]>(apiClient.get("/provider/equipment")),
  createEquipment: (payload: ProviderEquipmentInput) => request(apiClient.post("/provider/equipment", payload)),
  listAvailability: () => request<unknown[]>(apiClient.get("/provider/availability")),
  blockAvailability: (payload: unknown) => request(apiClient.post("/provider/availability/blocks", payload)),
  listRequests: () => request<ProviderRequest[]>(apiClient.get("/provider/requests")),
  acceptRequest: (requestId: string) => request(apiClient.post(`/provider/requests/${requestId}/accept`)),
  rejectRequest: (requestId: string, reason?: string) => request(apiClient.post(`/provider/requests/${requestId}/reject`, { reason })),
  listJobs: () => request<{ active: JobAssignment[]; upcoming: JobAssignment[]; completed: JobAssignment[] }>(apiClient.get("/provider/jobs")),
  jobDetail: (bookingId: string) => request<JobAssignment>(apiClient.get(`/provider/jobs/${bookingId}`)),
  messageCustomer: (bookingId: string, message: string) => request(apiClient.post(`/provider/jobs/${bookingId}/messages`, { message })),
  markEnRoute: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/en-route`)),
  markArrived: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/arrived`)),
  verifyPin: (bookingId: string, pin: string) => request(apiClient.post(`/provider/jobs/${bookingId}/verify-pin`, { pin })),
  startJob: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/start`)),
  completeJob: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/complete`)),
  takeBreak: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/break`)),
  resumeJob: (bookingId: string) => request(apiClient.post(`/provider/jobs/${bookingId}/resume`)),
  updateLocation: (payload: unknown) => request(apiClient.post("/provider/location", payload)),
  notifications: () => request<ProviderNotification[]>(apiClient.get("/provider/notifications")),
  uploadDocument: async (file: File, path: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("path", path);
    const response = await apiClient.post<{ data: { storage_path: string } }>("/provider/documents/upload", body, { headers: { "Content-Type": "multipart/form-data" } });
    return response.data.data.storage_path;
  }
};
