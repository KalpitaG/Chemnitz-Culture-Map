// hooks/useApi.ts - FIXED VERSION
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService, performanceUtils } from '../services/api';
import { 
  CulturalSite, 
  ParkingLot, 
  District, 
  SearchParams, 
  NearbyParams, 
  LoadingState,
  CategoryType,
  ParkingType 
} from '../types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Generic hook for API calls with performance monitoring
export function useApi<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = [],
  enablePerformanceLogging = false
): UseApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const startTime = enablePerformanceLogging ? performanceUtils.startTimer() : 0;
    
    try {
      const result = await apiCall();
      setState({ data: result, loading: false, error: null });
      
      if (enablePerformanceLogging) {
        const duration = performanceUtils.endTimer(startTime);
        performanceUtils.logPerformance('API Call', duration);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setState({ 
          data: null, 
          loading: false, 
          error: error.message || 'An error occurred' 
        });
      }
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData
  };
}

// Quick stats hook for header
export function useQuickStats() {
  return useApi(() => apiService.getQuickStats(), [], true);
}

// Enhanced cultural sites hook with performance optimization
export function useCulturalSites(params?: SearchParams) {
  const cacheRef = useRef<Map<string, CulturalSite[]>>(new Map());
  
  return useApi(
    async () => {
      const cacheKey = JSON.stringify(params);
      
      if (cacheRef.current.has(cacheKey)) {
        console.log('Using cached data for cultural sites');
        return cacheRef.current.get(cacheKey)!;
      }
      
      const result = await apiService.getCulturalSites(params);
      
      cacheRef.current.set(cacheKey, result);
      
      if (cacheRef.current.size > 10) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) {
          cacheRef.current.delete(firstKey);
        }
      }
      
      return result;
    },
    [JSON.stringify(params)],
    true
  );
}

// Cultural sites hook that defaults to Chemnitz for performance
export function useSmartCulturalSites(params?: SearchParams) {
  const smartParams = {
    source: 'chemnitz_geojson',
    limit: 1000, // INCREASED LIMIT
    ...params
  };

  return useCulturalSites(smartParams);
}

// Parking lots hook with caching
export function useParkingLots(params?: { parking_type?: string; district?: string }) {
  return useApi(
    () => apiService.getParkingLots(params),
    [JSON.stringify(params)]
  );
}

// Categories hook
export function useCategories() {
  return useApi(() => apiService.getCategories());
}

// District names hook for dropdown
export function useDistrictNames() {
  return useApi(() => apiService.getDistrictNames(), [], true);
}

// Full districts hook for map boundaries
export function useDistricts() {
  return useApi(() => apiService.getDistricts());
}

// Nearby sites hooks
export function useCulturalSitesNearby(params: NearbyParams | null) {
  return useApi(
    () => params ? apiService.getCulturalSitesNearby(params) : Promise.resolve([]),
    [JSON.stringify(params)]
  );
}

export function useParkingLotsNearby(params: NearbyParams | null) {
  return useApi(
    () => params ? apiService.getParkingLotsNearby(params) : Promise.resolve([]),
    [JSON.stringify(params)]
  );
}

// Enhanced search hook with debouncing
export function useSearch() {
  const [searchResults, setSearchResults] = useState<CulturalSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  const search = useCallback(async (query: string, category?: string, district?: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    debounceTimeoutRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await apiService.searchSites(query, category, district);
        setSearchResults(results);
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setSearchResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    searchResults,
    loading,
    error,
    search,
    clearSearch
  };
}

// FIXED: Combined map data hook for optimal performance
export function useMapData(options: {
  source?: string;
  district?: string;
  category?: string;
  categories?: CategoryType[];
  parkingTypes?: ParkingType[];
  includeParking?: boolean;
  includeDistricts?: boolean;
  limit?: number;
  includeChemnitzWhenSaxony?: boolean
} = {}) {
  const [data, setData] = useState<{
    sites: CulturalSite[];
    parking: ParkingLot[];
    districts: District[];
  }>({
    sites: [],
    parking: [],
    districts: []
  });
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    sites: true,
    parking: false,
    districts: false,
    search: false,
  });
  
  const [error, setError] = useState<string | null>(null);

  const fetchMapData = useCallback(async () => {
    console.log('🔄 useMapData: Starting fetch with options:', options);
    
    setLoadingState({
      sites: true,
      parking: options.includeParking || false,
      districts: options.includeDistricts || false,
      search: false
    });
    setError(null);

    const startTime = performanceUtils.startTimer();

    try {
      let allSites: CulturalSite[] = [];
      let allParking: ParkingLot[] = [];
      let allDistricts: District[] = [];

      // FIXED: Handle different source options properly
      if (options.source === 'sachsen_geojson') {
        console.log('📍 Fetching Sachsen + Chemnitz data...');
        
        // Fetch both Sachsen and Chemnitz data
        const [sachsenData, chemnitzData] = await Promise.all([
          apiService.getMapData({ 
            ...options, 
            source: 'sachsen_geojson',
            limit: options.limit || 2000 // Higher limit for Saxony
          }),
          apiService.getMapData({ 
            ...options, 
            source: 'chemnitz_geojson',
            limit: options.limit || 1000
          })
        ]);

        allSites = [...sachsenData.sites, ...chemnitzData.sites];
        allParking = [...sachsenData.parking, ...chemnitzData.parking];
        allDistricts = [...sachsenData.districts, ...chemnitzData.districts];
        
      } else {
        console.log(`📍 Fetching ${options.source || 'all'} data...`);
        
        // Single source fetch with higher limit
        const result = await apiService.getMapData({
          ...options,
          limit: options.limit || 1000 // Higher default limit
        });
        
        allSites = result.sites;
        allParking = result.parking;
        allDistricts = result.districts;
      }

      // FIXED: Apply category filtering on frontend (in case backend doesn't filter properly)
      if (options.categories && options.categories.length > 0 && options.categories.length < Object.values(CategoryType).length) {
        console.log('🎭 Filtering sites by categories:', options.categories);
        allSites = allSites.filter(site => options.categories!.includes(site.category));
      }

      // FIXED: Apply parking type filtering on frontend
      if (options.parkingTypes && options.parkingTypes.length > 0 && options.parkingTypes.length < Object.values(ParkingType).length) {
        console.log('🚗 Filtering parking by types:', options.parkingTypes);
        allParking = allParking.filter(parking => options.parkingTypes!.includes(parking.parking_type));
      }

      console.log('✅ Data loaded:', {
        sites: allSites.length,
        parking: allParking.length,
        districts: allDistricts.length
      });

      setData({
        sites: allSites,
        parking: allParking,
        districts: allDistricts
      });
      
      const duration = performanceUtils.endTimer(startTime);
      performanceUtils.logPerformance(
        'Map Data Load', 
        duration, 
        JSON.stringify({ sites: allSites.length, parking: allParking.length }).length
      );
      
    } catch (err: any) {
      console.error('❌ Map data fetch error:', err);
      setError(err.message || 'Failed to load map data');
    } finally {
      setLoadingState({
        sites: false,
        parking: false,
        districts: false,
        search: false
      });
    }
  }, [JSON.stringify(options)]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  return {
    ...data,
    loadingState,
    error,
    refetch: fetchMapData
  };
}

// Geolocation hook
export function useGeolocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  return {
    location,
    loading,
    error,
    refetch: getCurrentLocation
  };
}

// Performance monitoring hook
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    dataSize: 0
  });

  const startMeasurement = useCallback((name: string) => {
    performance.mark(`${name}-start`);
  }, []);

  const endMeasurement = useCallback((name: string) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    if (measure) {
      setMetrics(prev => ({
        ...prev,
        [name.replace('-', '_') + 'Time']: measure.duration
      }));
    }
  }, []);

  return {
    metrics,
    startMeasurement,
    endMeasurement
  };
}


// Enhanced search hook with advanced search integration
export function useAdvancedSearch() {
  const [searchResults, setSearchResults] = useState<CulturalSite[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStats, setSearchStats] = useState<{
    total: number;
    total_matches: number;
    has_more: boolean;
  }>({
    total: 0,
    total_matches: 0,
    has_more: false
  });

  const performSearch = useCallback(async (params: {
    query?: string;
    category?: CategoryType;
    categories?: CategoryType[];
    district?: string;
    source?: string;
    sort_by?: string;
    sort_order?: string;
    limit?: number;
  }) => {
    console.log('🔍 Starting advanced search with params:', params);
    
    setIsSearching(true);
    setSearchError(null);

    try {
      // Convert multi-category selection to single category for backend
      let categoryParam = params.category;
      if (params.categories && params.categories.length === 1) {
        categoryParam = params.categories[0];
      }

      const searchParams = {
        q: params.query,
        category: categoryParam,
        district: params.district,
        source: params.source,
        sort_by: params.sort_by || 'name',
        sort_order: params.sort_order || 'asc',
        limit: params.limit || 100
      };

      const response = await apiService.advancedSearch(searchParams);
      
      let filteredResults = response.sites;

      // Frontend filtering for multi-category selection
      if (params.categories && params.categories.length > 1) {
        filteredResults = response.sites.filter(site => 
          params.categories!.includes(site.category)
        );
      }

      setSearchResults(filteredResults);
      setSearchStats({
        total: filteredResults.length,
        total_matches: response.total_matches,
        has_more: response.pagination.has_more
      });
      setSearchQuery(params.query || '');

      console.log('✅ Search completed:', {
        query: params.query,
        results: filteredResults.length,
        total_matches: response.total_matches
      });

    } catch (error: any) {
      console.error('❌ Search failed:', error);
      setSearchError(error.message || 'Search failed');
      setSearchResults([]);
      setSearchStats({ total: 0, total_matches: 0, has_more: false });
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    console.log('🧹 Clearing search results');
    setSearchResults([]);
    setSearchError(null);
    setSearchQuery('');
    setSearchStats({ total: 0, total_matches: 0, has_more: false });
    setIsSearching(false);
  }, []);

  const searchByQuery = useCallback((query: string, additionalParams?: any) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    performSearch({
      query: query.trim(),
      ...additionalParams
    });
  }, [performSearch, clearSearch]);

  return {
    // State
    searchResults,
    isSearching,
    searchError,
    searchQuery,
    searchStats,
    
    // Actions
    performSearch,
    clearSearch,
    searchByQuery,
    
    // Computed
    hasSearchResults: searchResults.length > 0,
    isSearchActive: !!searchQuery
  };
}

// NEW: Hook for nearby parking search
export function useNearbyParking() {
  const [nearbyParking, setNearbyParking] = useState<{
    parkingLots: ParkingLot[];
    connections: Array<{
      siteId: string;
      parkingId: string;
      distance: number;
    }>;
  }>({
    parkingLots: [],
    connections: []
  });
  
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchNearbyParking = useCallback(async (
    culturalSites: CulturalSite[],
    parkingTypes?: string[],
    radiusKm: number = 1
  ) => {
    if (!culturalSites || culturalSites.length === 0) {
      setNearbyParking({ parkingLots: [], connections: [] });
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await apiService.findParkingNearSites(
        culturalSites, 
        radiusKm, 
        parkingTypes
      );
      setNearbyParking(result);
    } catch (err: any) {
      console.error('Nearby parking search failed:', err);
      setError(err.message || 'Failed to find nearby parking');
      setNearbyParking({ parkingLots: [], connections: [] });
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearNearbyParking = useCallback(() => {
    setNearbyParking({ parkingLots: [], connections: [] });
    setError(null);
  }, []);

  return {
    nearbyParking: nearbyParking.parkingLots,
    parkingConnections: nearbyParking.connections,
    isSearchingParking: isSearching,
    parkingError: error,
    searchNearbyParking,
    clearNearbyParking,
    hasNearbyParking: nearbyParking.parkingLots.length > 0
  };
}