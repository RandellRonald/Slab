export interface Address {
  label?: string;
  line1: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface BookingItem {
  equipment_type: string;
  quantity: number;
  duration_hours: number;
  operator_required: boolean;
}

export interface PricingEstimate {
  currency: string;
  line_items: Array<BookingItem & { hourly_rate: number; operator_rate: number; line_total: number }>;
  distance_km?: number;
  equipment_subtotal: number;
  travel_charge: number;
  emergency_service_charge?: number;
  platform_fee: number;
  estimated_total: number;
  is_emergency?: boolean;
  pricing_version: string;
}
