import axios, { AxiosError } from "axios";

import { env } from "../config/env";
import type { ApiEnvelope } from "../types/auth";

export class ApiClientError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use(async (config) => {
  const accessToken = localStorage.getItem("slab_access_token");
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    if (!response.data.success) {
      throw new ApiClientError(response.data.error.code, response.data.error.message);
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    const axiosError = error as AxiosError<ApiEnvelope<unknown>>;
    if (axiosError.response?.data && !axiosError.response.data.success) {
      const apiError = axiosError.response.data.error;
      throw new ApiClientError(apiError.code, apiError.message, axiosError.response.status);
    }

    throw new ApiClientError("NETWORK_ERROR", "Unable to reach the SLAB API.");
  }
}
