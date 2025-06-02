/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosResponse } from 'axios';
import {
  CulturalSite,
  ParkingLot,
  District,
  Category,
  SearchParams,
  NearbyParams,
  CulturalSitesResponse,
  QuickStats
} from '../types';

// Define DistrictName locally if not exported from types
interface DistrictName {
  id: string;
  name: string;
}

// Base API configuration
const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});



const savedToken = localStorage.getItem("authToken");
if (savedToken) {
  api.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
}

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    if (config.params) {
      console.log(`📊 Parameters:`, config.params);
    }
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and performance monitoring
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const loadTime = Date.now() - (response.config as any).requestStartTime;
    console.log(`✅ API Response: ${response.config.url} - ${response.status} (${loadTime}ms)`);
    return response;
  },
  (error) => {
    
    console.error('❌ API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Add request timing
api.interceptors.request.use((config) => {
  (config as any).requestStartTime = Date.now();
  return config;
});

// API service functions
export const apiService = {
  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await api.get('/api/health');
    return response.data;
  },

  // Quick stats for performance
  async getQuickStats(): Promise<QuickStats> {
    const response = await api.get('/api/stats/quick');
    return response.data;
  },

  // Cultural Sites with enhanced parameters
  async getCulturalSites(params?: SearchParams): Promise<CulturalSite[]> {
    const response = await api.get('/api/cultural-sites', { params });
    
    console.log('🔍 Cultural Sites raw response:', response.data);
    
    // Backend returns: { "sites": [...], "parking_lots": [...], "districts": [...] }
    if (response.data && Array.isArray(response.data.sites)) {
      return response.data.sites.map((site: any) => ({
        id: site.id,
        name: site.name,
        category: site.category,
        description: site.description,
        address: site.address,
        location: site.location,
        website: site.website,
        phone: site.phone,
        opening_hours: site.opening_hours,
        properties: site.properties,
        source: site.source,
        source_id: site.source_id,
        created_at: site.created_at,
        updated_at: site.updated_at
      }));
    }
    
    console.error('Unexpected cultural sites API response format:', response.data);
    return [];
  },

  // NEW: Enhanced cultural sites with optional data
  async getCulturalSitesEnhanced(params?: SearchParams): Promise<CulturalSitesResponse> {
    const response = await api.get('/api/cultural-sites', { params });
    return response.data;
  },

  async getCulturalSiteById(id: string): Promise<CulturalSite> {
    const response = await api.get(`/api/cultural-sites/${id}`);
    return response.data;
  },

  async getCulturalSitesNearby(params: NearbyParams): Promise<CulturalSite[]> {
    const response = await api.get('/api/cultural-sites/near', { params });
    return response.data.sites || response.data;
  },

  // Parking Lots with district filtering
  async getParkingLots(params?: { parking_type?: string; district?: string }): Promise<ParkingLot[]> {
    const response = await api.get('/api/parking-lots', { params });
    
    console.log('🔍 Parking lots raw response:', response.data);
    
    // Backend returns: { "parking_lots": [...] }
    if (response.data && Array.isArray(response.data.parking_lots)) {
      return response.data.parking_lots.map((parking: any) => ({
        id: parking.id,
        name: parking.name,
        location: parking.location,
        parking_type: parking.parking_type,
        capacity: parking.capacity,
        address: parking.address,
        description: parking.description,
        properties: parking.properties,
        created_at: parking.created_at,
        updated_at: parking.updated_at
      }));
    }
    
    console.error('Unexpected parking API response format:', response.data);
    return [];
  },

  async getParkingLotById(id: string): Promise<ParkingLot> {
    const response = await api.get(`/api/parking-lots/${id}`);
    return response.data;
  },

  async getParkingLotsNearby(params: NearbyParams): Promise<ParkingLot[]> {
    const response = await api.get('/api/parking-lots/near', { params });
    return response.data.parking_lots || response.data;
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await api.get('/api/categories');
    return response.data;
  },

  async getCategoryByName(categoryName: string): Promise<Category> {
    const response = await api.get(`/api/categories/${categoryName}`);
    return response.data;
  },

  // Districts endpoints
  async getDistricts(): Promise<District[]> {
    const response = await api.get('/api/districts');
    console.log('🔍 Districts raw response:', response.data);
    return response.data.districts || response.data;
  },

  // District names for dropdown (performance optimized)
  async getDistrictNames(): Promise<DistrictName[]> {
    try {
      const response = await api.get('/api/districts/names');
      console.log('🏘️ District names raw response:', response.data);
      
      if (response.data && Array.isArray(response.data.districts)) {
        console.log('✅ District names found:', response.data.districts.length);
        return response.data.districts;
      }
      
      console.error('❌ Unexpected district names API response format:', response.data);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch district names:', error);
      return [];
    }
  },

  // Enhanced search functionality
  async searchSites(query: string, category?: string, district?: string): Promise<CulturalSite[]> {
    const params: SearchParams = { search: query };
    if (category) params.category = category as any;
    if (district) params.district = district;
    
    return this.getCulturalSites(params);
  },

  // Get sites by category with optional district
  async getSitesByCategory(category: string, district?: string): Promise<CulturalSite[]> {
    const params: SearchParams = { category: category as any };
    if (district) params.district = district;
    
    return this.getCulturalSites(params);
  },

  // Performance optimized endpoints
  async getChemnitzSites(limit = 100): Promise<CulturalSite[]> {
    return this.getCulturalSites({
      source: 'chemnitz_geojson',
      limit
    });
  },

  async getSachsenSites(limit = 500): Promise<CulturalSite[]> {
    return this.getCulturalSites({
      source: 'sachsen_geojson',
      limit
    });
  },

  // Combined data for map with performance options
  async getMapData(options: {
    source?: string;
    district?: string;
    category?: string;
    includeParking?: boolean;
    includeDistricts?: boolean;
    limit?: number;
  } = {}): Promise<{
    sites: CulturalSite[];
    parking: ParkingLot[];
    districts: District[];
  }> {
    const {
      source,
      district,
      category,
      includeParking = false,
      includeDistricts = false,
      limit = 100
    } = options;

    try {
      // Get cultural sites with optional data in one request
      const sitesParams: SearchParams = {
        limit,
        include_parking: includeParking,
        include_districts: includeDistricts
      };

      if (source && source !== 'all') sitesParams.source = source;
      if (district) sitesParams.district = district;
      if (category) sitesParams.category = category as any;

      const response = await this.getCulturalSitesEnhanced(sitesParams);

      return {
        sites: response.sites,
        parking: response.parking_lots || [],
        districts: response.districts || []
      };
    } catch (error) {
      console.error('Error fetching map data:', error);
      return {
        sites: [],
        parking: [],
        districts: []
      };
    }
  }
};

// Utility functions for coordinate conversion
export const geoUtils = {
  // Convert MongoDB GeoJSON to Leaflet format
  mongoLocationToLeaflet(location: { coordinates: [number, number] }): [number, number] {
    // MongoDB stores as [lng, lat], Leaflet expects [lat, lng]
    return [location.coordinates[1], location.coordinates[0]];
  },

  // Convert Leaflet format to MongoDB GeoJSON
  leafletToMongoLocation(lat: number, lng: number): { type: 'Point'; coordinates: [number, number] } {
    return {
      type: 'Point',
      coordinates: [lng, lat] // MongoDB format: [lng, lat]
    };
  },

  // Calculate distance between two points (rough approximation)
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  // Performance utilities
  estimateDataSize(sites: CulturalSite[], parking: ParkingLot[], districts: District[]): number {
    return JSON.stringify({ sites, parking, districts }).length;
  },

  // Smart batching for large datasets
  createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
};

// Performance monitoring utilities
export const performanceUtils = {
  startTimer(): number {
    return performance.now();
  },

  endTimer(startTime: number): number {
    return performance.now() - startTime;
  },

  logPerformance(operation: string, duration: number, dataSize?: number) {
    console.log(`⚡ Performance: ${operation} took ${duration.toFixed(2)}ms${dataSize ? ` for ${dataSize} bytes` : ''}`);
  }
};

export default apiService;