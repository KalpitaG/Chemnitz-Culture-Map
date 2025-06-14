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

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Define DistrictName locally if not exported from types
interface DistrictName {
  id: string;
  name: string;
}

// Search-related interfaces
export interface AutocompleteResponse {
  suggestions: Array<{
    id: string;
    name: string;
    category: string;
    address?: string;
  }>;
  query: string;
  total: number;
}

export interface AdvancedSearchResponse {
  sites: CulturalSite[];
  total: number;
  total_matches: number;
  filters: {
    q?: string;
    category?: string;
    district?: string;
    source?: string;
    has_website?: boolean;
    has_phone?: boolean;
    has_opening_hours?: boolean;
    created_after?: string;
    created_before?: string;
  };
  pagination: {
    limit: number;
    skip: number;
    has_more: boolean;
  };
  sorting: {
    sort_by: string;
    sort_order: string;
  };
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

// Token management
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

// Request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

// Response interceptor for error handling and token management
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const loadTime = Date.now() - (response.config as any).requestStartTime;
    console.log(`✅ API Response: ${response.config.url} - ${response.status} (${loadTime}ms)`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      tokenManager.removeToken();
      // You might want to redirect to login here or emit an event
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    
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
  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post('/api/auth/login', credentials);
      const authData: AuthResponse = response.data;
      
      // Store token and user data
      tokenManager.setToken(authData.access_token);
      tokenManager.setUser(authData.user);
      
      console.log('✅ Login successful:', authData.user.email);
      return authData;
    } catch (error: any) {
      console.error('❌ Login failed:', error.response?.data?.detail || error.message);
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await api.post('/api/auth/register', userData);
      const authData: AuthResponse = response.data;
      
      // Store token and user data
      tokenManager.setToken(authData.access_token);
      tokenManager.setUser(authData.user);
      
      console.log('✅ Registration successful:', authData.user.email);
      return authData;
    } catch (error: any) {
      console.error('❌ Registration failed:', error.response?.data?.detail || error.message);
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('❌ Logout API call failed:', error);
    } finally {
      // Always clear local storage
      tokenManager.removeToken();
      console.log('✅ Logged out successfully');
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/api/auth/me');
      const user: User = response.data;
      tokenManager.setUser(user); // Update stored user data
      return user;
    } catch (error: any) {
      console.error('❌ Failed to get current user:', error.response?.data?.detail || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to get user info');
    }
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!tokenManager.getToken();
  },

  // Get current user from localStorage
  getCurrentUserFromStorage(): User | null {
    return tokenManager.getUser();
  },

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


  // Search functionality
  async autocompleteSearch(query: string, limit = 10): Promise<AutocompleteResponse> {
    try {
      if (query.length < 2) {
        return { suggestions: [], query, total: 0 };
      }
      
      const response = await api.get('/api/search/autocomplete', {
        params: { q: query, limit }
      });
      
      console.log('🔍 Autocomplete results:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Autocomplete search failed:', error);
      return { suggestions: [], query, total: 0 };
    }
  },

  async advancedSearch(params: {
    q?: string;
    category?: string;
    district?: string;
    source?: string;
    has_website?: boolean;
    has_phone?: boolean;
    has_opening_hours?: boolean;
    sort_by?: string;
    sort_order?: string;
    limit?: number;
    skip?: number;
  }): Promise<AdvancedSearchResponse> {
    try {
      const response = await api.get('/api/search/advanced', { params });
      
      console.log('🔍 Advanced search results:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Advanced search failed:', error);
      throw new Error(error.response?.data?.detail || 'Search failed');
    }
  },

  async getPopularSites(category?: string, limit = 10): Promise<{ sites: CulturalSite[]; total: number; criteria: string }> {
    try {
      const params: any = { limit };
      if (category) params.category = category;
      
      const response = await api.get('/api/search/popular', { params });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get popular sites:', error);
      return { sites: [], total: 0, criteria: 'Error loading popular sites' };
    }
  },

  async searchNearby(lat: number, lng: number, radius = 1000, category?: string, limit = 50): Promise<{ sites: CulturalSite[]; total: number }> {
    try {
      const params: any = { lat, lng, radius, limit };
      if (category) params.category = category;
      
      const response = await api.get('/api/search/nearby', { params });
      return response.data;
    } catch (error: any) {
      console.error('❌ Nearby search failed:', error);
      return { sites: [], total: 0 };
    }
  },

  // Get sites by category with optional district
  async getSitesByCategory(category: string, district?: string): Promise<CulturalSite[]> {
    const params: SearchParams = { category: category as any };
    if (district) params.district = district;
    return this.getCulturalSites(params);
  },

  // NEW: Find parking lots near cultural sites
  async findParkingNearSites(
    culturalSites: CulturalSite[], 
    radiusKm: number = 1,
    parkingTypes?: string[]
  ): Promise<{
    parkingLots: ParkingLot[];
    connections: Array<{
      siteId: string;
      parkingId: string;
      distance: number;
    }>;
  }> {
    try {
      if (!culturalSites || culturalSites.length === 0) {
        return { parkingLots: [], connections: [] };
      }

      const allNearbyParking: Array<{
        parking: ParkingLot;
        siteId: string;
        distance: number;
      }> = [];

      // For each cultural site, find nearby parking using geospatial API
      for (const site of culturalSites) {
        if (!site.location?.coordinates) continue;

        const [lng, lat] = site.location.coordinates;
        
        try {
          // Use existing nearby parking API
          const response = await api.get('/api/parking-lots/near', {
            params: {
              lat,
              lng,
              radius: radiusKm * 1000, // Convert km to meters
              limit: 20
            }
          });

          const nearbyParking = response.data.parking_lots || response.data;

          for (const parking of nearbyParking) {
            // Apply parking type filter if specified
            if (parkingTypes && parkingTypes.length > 0 && !parkingTypes.includes(parking.parking_type)) {
              continue;
            }

            // Calculate distance (rough approximation)
            if (parking.location?.coordinates) {
              const [pLng, pLat] = parking.location.coordinates;
              const distance = geoUtils.calculateDistance(lat, lng, pLat, pLng);
              
              allNearbyParking.push({
                parking,
                siteId: site.id,
                distance: distance * 1000 // Convert to meters
              });
            }
          }
        } catch (error) {
          console.error(`Error finding parking near site ${site.name}:`, error);
        }
      }

      // Deduplicate parking lots (same parking lot found near multiple sites)
      const uniqueParkingMap = new Map<string, {
        parking: ParkingLot;
        nearestSites: Array<{ siteId: string; distance: number; }>;
      }>();

      for (const item of allNearbyParking) {
        const parkingId = item.parking.id;
        
        if (uniqueParkingMap.has(parkingId)) {
          // Add this site to the existing parking's nearby sites
          uniqueParkingMap.get(parkingId)!.nearestSites.push({
            siteId: item.siteId,
            distance: item.distance
          });
        } else {
          // First time seeing this parking lot
          uniqueParkingMap.set(parkingId, {
            parking: item.parking,
            nearestSites: [{ siteId: item.siteId, distance: item.distance }]
          });
        }
      }

      // Build final results
      const uniqueParking: ParkingLot[] = [];
      const connections: Array<{
        siteId: string;
        parkingId: string;
        distance: number;
      }> = [];

      for (const [parkingId, data] of uniqueParkingMap) {
        uniqueParking.push(data.parking);
        
        // Create connections to all nearby sites
        for (const siteConnection of data.nearestSites) {
          connections.push({
            siteId: siteConnection.siteId,
            parkingId: parkingId,
            distance: siteConnection.distance
          });
        }
      }

      console.log(`✅ Found ${uniqueParking.length} unique parking lots near ${culturalSites.length} sites`);
      console.log(`📊 Total connections: ${connections.length}`);

      return {
        parkingLots: uniqueParking,
        connections
      };

    } catch (error) {
      console.error('❌ Error finding nearby parking:', error);
      return { parkingLots: [], connections: [] };
    }
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
    return [location.coordinates[1], location.coordinates[0]];
  },

  // Convert Leaflet format to MongoDB GeoJSON
  leafletToMongoLocation(lat: number, lng: number): { type: 'Point'; coordinates: [number, number] } {
    return {
      type: 'Point',
      coordinates: [lng, lat]
    };
  },

  // Calculate distance between two points (rough approximation)
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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