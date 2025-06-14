// App.tsx - FIXED VERSION
import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/App.css';

// Import new components
import Layout from './components/Layout/Layout';
import MapContainer from './components/Map/MapContainer';

// Import authentication components
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth/Auth';

import {
  FilterState,
  SourceType,
  ParkingType,
  CategoryType
} from './types';

import {
  useDistrictNames,
  useMapData
} from './hooks/useApi';

// Your existing main app component with FIXED filtering
const MainApp: React.FC = () => {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    source: SourceType.CHEMNITZ, // Start with Chemnitz
    district: undefined,
    categories: Object.values(CategoryType), // ALL categories selected by default
    parkingTypes: [], 
    mapLayers: {
      showParking: true,
      showDistricts: true,
      showCulturalSites: true,
    },
  });

  const onFilterUpdate = (updates: Partial<FilterState>) => {
    console.log('🔄 Filter Update:', updates);
    setFilterState((prev) => {
      const newState = { ...prev, ...updates };
      console.log('📊 New Filter State:', newState);
      return newState;
    });
  };

  // API hooks - only destructure what we actually use
  const {
    data: districtNames,
    loading: districtsLoading
  } = useDistrictNames();

  // FIXED: Pass ALL filter parameters to useMapData
  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError
  } = useMapData({
    source: filterState.source,
    district: filterState.district,
    categories: filterState.categories, // Pass selected categories
    parkingTypes: filterState.parkingTypes, // Pass selected parking types
    includeParking: filterState.mapLayers.showParking && filterState.parkingTypes && filterState.parkingTypes.length > 0,
    includeDistricts: filterState.mapLayers.showDistricts,
    limit: 2000, // INCREASED LIMIT - get more data
    includeChemnitzWhenSaxony: filterState.source === SourceType.SACHSEN
  });

  // Log what we're actually getting
  console.log('📊 App Debug:', {
    filterState,
    dataLoaded: {
      sites: sites.length,
      parking: parking.length,
      districts: districts.length
    },
    loading: loadingState.sites
  });

  return (
    <Layout
      filterState={filterState}
      onFilterUpdate={onFilterUpdate}
      districtNames={districtNames || []}
      districtsLoading={districtsLoading}
    >
      <MapContainer
        culturalSites={sites} // These should now be properly filtered
        parkingLots={parking} // These should now be properly filtered
        districts={districts}
        loading={loadingState.sites}
        selectedDistrict={filterState.district}
        mapError={mapError}
      />
    </Layout>
  );
};

// Main App Component with Authentication Wrapper
const App: React.FC = () => {
  const authState = useAuth();
  const { isAuthenticated, isLoading, user } = authState;

  // Create a unique key based on auth state to force re-renders
  const appKey = `app-${isAuthenticated ? 'auth' : 'noauth'}-${user?.id || 'nouser'}`;

  // Debug logging with more details
  console.log('🔍 App Debug - Authentication State:', {
    isAuthenticated,
    isLoading,
    user: user?.email || 'null',
    userId: user?.id || 'null',
    token: localStorage.getItem('auth_token') ? 'exists' : 'missing',
    userStorage: localStorage.getItem('auth_user') ? 'exists' : 'missing',
    timestamp: new Date().toLocaleTimeString(),
    appKey
  });

  // Show loading spinner on initial auth check
  if (isLoading) {
    console.log('🕐 App: Showing loading state');
    return (
      <div key={`${appKey}-loading`} className="d-flex justify-content-center align-items-center bg-gray-50" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-gray-600">Initializing Chemnitz Cultural Explorer...</p>
        </div>
      </div>
    );
  }

  // Show auth forms if not authenticated
  if (!isAuthenticated) {
    console.log('🔐 App: User not authenticated, showing auth forms');
    return (
      <div key={`${appKey}-auth`}>
        <Auth 
          onAuthSuccess={() => {
            console.log('✅ Auth Success Callback: User authenticated, forcing re-render...');
            
            // Check auth state immediately
            console.log('🔍 Immediate post-login check:', {
              currentAuthState: authState.isAuthenticated,
              currentUser: authState.user?.email,
              localStorage: {
                token: localStorage.getItem('auth_token') ? 'exists' : 'missing',
                user: localStorage.getItem('auth_user') ? 'exists' : 'missing'
              }
            });
            
            // Force a small delay to ensure state is fully updated
            setTimeout(() => {
              console.log('🔄 Delayed post-login state check:', {
                isAuthenticated: authState.isAuthenticated,
                user: authState.user?.email,
                shouldShowMap: authState.isAuthenticated && authState.user
              });
              
              // If state hasn't updated, force a page reload as backup
              if (!authState.isAuthenticated) {
                console.log('⚠️ Auth state not updated, forcing page reload...');
                window.location.reload();
              }
            }, 500);
          }} 
        />
      </div>
    );
  }

  // Show your new map UI immediately after authentication
  console.log('🗺️ App: User authenticated, showing map interface for:', user?.email);
  return (
    <div key={`${appKey}-main`}>
      <MainApp />
    </div>
  );
};

export default App;