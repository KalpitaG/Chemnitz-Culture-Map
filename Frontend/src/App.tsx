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

// Import debug component (create this file)
// import AuthDebug from './components/Auth/AuthDebug';

import {
  FilterState,
  SourceType,
  ParkingType
} from './types';

import {
  useDistrictNames,
  useMapData
} from './hooks/useApi';

// Your existing main app component with new layout
const MainApp: React.FC = () => {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    source: SourceType.CHEMNITZ,
    district: undefined,
    category: undefined,
    categories: [], // New multi-select categories
    parkingTypes: [ParkingType.BUS, ParkingType.CARAVAN], // Show all parking by default
    mapLayers: {
      showParking: true,
      showDistricts: true,
      showCulturalSites: true,
    },
  });

  const onFilterUpdate = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  // API hooks - only destructure what we actually use
  const {
    data: districtNames,
    loading: districtsLoading
  } = useDistrictNames();

  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError
  } = useMapData({
    source: filterState.source !== SourceType.SACHSEN ? filterState.source : undefined,
    district: filterState.district,
    category: filterState.category || (filterState.categories && filterState.categories.length > 0 ? filterState.categories[0] : undefined),
    includeParking: filterState.mapLayers.showParking,
    includeDistricts: filterState.mapLayers.showDistricts,
    includeChemnitzWhenSaxony: filterState.source === SourceType.SACHSEN
  });

  // Filter sites based on selected categories
  const filteredSites = filterState.categories && filterState.categories.length > 0
    ? sites.filter(site => filterState.categories!.includes(site.category))
    : sites;

  // Filter parking based on selected types
  const filteredParking = filterState.parkingTypes && filterState.parkingTypes.length > 0
    ? parking.filter(p => filterState.parkingTypes!.includes(p.parking_type))
    : parking;

  return (
    <Layout
      filterState={filterState}
      onFilterUpdate={onFilterUpdate}
      districtNames={districtNames || []}
      districtsLoading={districtsLoading}
    >
      <MapContainer
        culturalSites={filteredSites}
        parkingLots={filteredParking}
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
      {/* Uncomment this line if you create the AuthDebug component */}
      {/* <AuthDebug /> */}
      <MainApp />
    </div>
  );
};

export default App;