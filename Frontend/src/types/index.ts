/* eslint-disable @typescript-eslint/no-explicit-any */
// types/index.ts
export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Use const objects instead of enums to avoid conflicts
export const CategoryType = {
  THEATRE: 'theatre',
  MUSEUM: 'museum',
  RESTAURANT: 'restaurant',
  ARTWORK: 'artwork'
} as const;

export type CategoryType = typeof CategoryType[keyof typeof CategoryType];

export const ParkingType = {
  BUS: 'bus',
  CARAVAN: 'caravan'
} as const;

export type ParkingType = typeof ParkingType[keyof typeof ParkingType];

// Source types for better filtering
export const SourceType = {
  CHEMNITZ: 'chemnitz_geojson',
  SACHSEN: 'sachsen_geojson'
} as const;

export type SourceType = typeof SourceType[keyof typeof SourceType];

export interface CulturalSite {
  id: string;
  name: string;
  category: CategoryType;
  description?: string;
  address?: string;
  location: Location;
  website?: string;
  phone?: string;
  opening_hours?: string;
  properties?: Record<string, any>;
  source?: string;
  source_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParkingLot {
  id: string;
  name: string;
  location: Location;
  parking_type: ParkingType;
  capacity?: number;
  address?: string;
  description?: string;
  properties?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface District {
  id: string;
  name: string;
  geometry: any; // GeoJSON geometry
  properties?: Record<string, any>;
}

// Simplified district for dropdowns
export interface DistrictName {
  id: string;
  name: string;
}

// Enhanced search parameters
export interface SearchParams {
  search?: string;
  category?: CategoryType;
  source?: string; 
  district?: string;  
  limit?: number;
  skip?: number;
  include_parking?: boolean;  
  include_districts?: boolean;  
}

export interface NearbyParams {
  lat: number;
  lng: number;
  max_distance?: number;
  limit?: number;
}

// Enhanced API response types
export interface ApiResponse<T> {
  data: T;
  total?: number;
  message?: string;
}

export interface CulturalSitesResponse {
  sites: CulturalSite[];
  total: number;
  filters: {
    category?: CategoryType;
    source?: string;
    district?: string;
    search?: string;
    limit: number;
    skip: number;
  };
  parking_lots?: ParkingLot[];  
  districts?: District[];       
}

export interface ParkingLotsResponse {
  parking_lots: ParkingLot[];
  total: number;
  filters: {
    parking_type?: string;
    district?: string;
  };
}

export interface DistrictsResponse {
  districts: District[];
  total: number;
}

export interface DistrictNamesResponse {
  districts: DistrictName[];
  total: number;
}

export interface Category {
  name: CategoryType;
  count: number;
}

// Quick stats for performance
export interface QuickStats {
  total_sites: number;
  chemnitz_sites: number;
  sachsen_sites: number;
  total_parking: number;
  total_districts: number;
  sites_by_category: Record<string, number>;
  performance_note: string;
}

// Map layer toggles
export interface MapLayerToggles {
  showCulturalSites: boolean;
  showParking: boolean;
  showDistricts: boolean;
}

// Enhanced filter state (updated version)
export interface FilterState {
  search: string;
  source: SourceType;
  district?: string;
  category?: CategoryType; // Keep for backward compatibility
  categories?: CategoryType[]; // New multi-select categories
  parkingTypes?: ParkingType[]; // New parking filter
  mapLayers: MapLayerToggles;
}

// Performance monitoring
export interface PerformanceMetrics {
  loadTime: number;
  dataSize: number;
  renderTime: number;
}

// Enhanced error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Loading states
export interface LoadingState {
  sites: boolean;
  parking: boolean;
  districts: boolean;
  search: boolean;
}