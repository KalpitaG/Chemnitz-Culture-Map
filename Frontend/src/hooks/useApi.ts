/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService, performanceUtils } from '../services/api';
import { 
  CulturalSite, 
  ParkingLot, 
  District, 
  SearchParams, 
  NearbyParams, 
  LoadingState 
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
    // Cancel previous request if still pending
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
  // Default to Chemnitz if no source specified
  const smartParams = {
    source: 'chemnitz_geojson',
    limit: 100,
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

//  Full districts hook for map boundaries
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
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Debounce search
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

//  Combined map data hook for optimal performance
export function useMapData(options: {
  source?: string;
  district?: string;
  category?: string;
  includeParking?: boolean;
  includeDistricts?: boolean;
  limit?: number;
  includeChemnitzWhenSaxony?: boolean;
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
    search: false
  });
  
  const [error, setError] = useState<string | null>(null);

  const fetchMapData = useCallback(async () => {
    setLoadingState({
      sites: true,
      parking: options.includeParking || false,
      districts: options.includeDistricts || false,
      search: false
    });
    setError(null);

    const startTime = performanceUtils.startTimer();

    try {
      let finalResult;

    if (options.source === 'sachsen_geojson') {
      // Fetch both Sachsen and Chemnitz data
      const [sachsenData, chemnitzData] = await Promise.all([
        apiService.getMapData({ ...options, source: 'sachsen_geojson' }),
        apiService.getMapData({ ...options, source: 'chemnitz_geojson' }),
      ]);

      // Merge cultural sites and parking from both sources
      finalResult = {
        sites: [...sachsenData.sites, ...chemnitzData.sites],
        parking: [...sachsenData.parking, ...chemnitzData.parking],
        districts: [...sachsenData.districts, ...chemnitzData.districts],
      };
    } else {
      // Default to single source fetch
      finalResult = await apiService.getMapData(options);
    }

setData(finalResult);
      
      const duration = performanceUtils.endTimer(startTime);
      performanceUtils.logPerformance(
        'Map Data Load', 
        duration, 
        JSON.stringify(finalResult).length
      );
      
    } catch (err: any) {
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

//  Performance monitoring hook
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