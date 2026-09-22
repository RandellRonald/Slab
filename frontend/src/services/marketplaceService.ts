import { apiClient, request } from "../api/client";

export interface MarketplaceProvider {
  id: string;
  name: string;
  company_name?: string;
  rating?: number;
  rating_count?: number;
  is_online: boolean;
  verification_status: string;
}

export interface MarketplaceEquipment {
  slug: string;
  name: string;
  category: string;
  hourly_rate: number;
  daily_rate: number;
  available_count: number;
  providers: MarketplaceProvider[];
}

export const marketplaceService = {
  listEquipment: (category?: string) =>
    request<MarketplaceEquipment[]>(apiClient.get("/marketplace/equipment", { params: category ? { category } : undefined }))
};
