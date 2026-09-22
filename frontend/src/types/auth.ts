export type AppRole = "customer" | "provider" | "admin";

export interface CurrentUser {
  user_id: string;
  profile_id: string;
  email?: string | null;
  role: AppRole;
  full_name?: string | null;
  is_active: boolean;
  joined_at?: string | null;
}

export interface AuthSessionPayload {
  user: CurrentUser;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type: "bearer";
  expires_in?: number | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
