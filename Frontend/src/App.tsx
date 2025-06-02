/* src/App.tsx */
import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth, ProtectedRoute } from "./Context/AuthContext"
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import ChemnitzMap from "./components/Chemnitz_Map/Chemnitz_Map";
import { 
  useDistrictNames, 
  useCategories, 
  useSearch, 
  useQuickStats,
  useMapData 
} from "./hooks/useApi";
import { SourceType, FilterState } from "./types";

import "./App.css";
import "./custom.css";

//
// 1) NAVBAR COMPONENT (shows login/signup or user+logout)
//
function Navbar() {
  const { user, signout, isAuthenticated } = useAuth();

  return (
    <nav className="bg-blue-800 text-white px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-xl font-bold hover:text-blue-200">
        Chemnitz Explorer
      </Link>
      {isAuthenticated && user ? (
        <div className="flex items-center space-x-4">
          <span className="font-medium">Hello, {user.first_name}</span>
          <button
            onClick={signout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="space-x-4">
          <Link
            to="/login"
            className="hover:text-blue-200 border border-white px-3 py-1 rounded"
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className="hover:text-blue-200 border border-white px-3 py-1 rounded"
          >
            Sign Up
          </Link>
        </div>
      )}
    </nav>
  );
}

//
// 2) HOME (Map) COMPONENT: EXACTLY your previous App contents, wrapped in ProtectedRoute
//
function Home() {
  // Copy/paste your previous "App()" contents from before, minus the <footer> & <header> stuff if you want,
  // But for clarity I’ll inline it here with minimal changes:

  const [filterState, setFilterState] = React.useState<FilterState>({
    category: undefined,
    source: SourceType.CHEMNITZ,
    district: undefined,
    search: "",
    mapLayers: {
      showCulturalSites: true,
      showParking: false,
      showDistricts: false,
    },
  });

  // Quick stats for header (optimized endpoint)
  const { data: quickStats } = useQuickStats();

  // District names for dropdown (optimized - names only)
  const {
    data: districtNames,
    loading: districtsLoading,
    error: districtsError,
  } = useDistrictNames();

  // DEBUG: Add debugging for districts
  React.useEffect(() => {
    console.log("🏘️ Districts Debug:", {
      districtNames,
      loading: districtsLoading,
      error: districtsError,
      count: districtNames?.length || 0,
    });
  }, [districtNames, districtsLoading, districtsError]);

  // Categories
  const {
    data: categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useCategories();

  // Enhanced map data hook - fetches everything optimally
  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError,
    refetch: refetchMapData,
  } = useMapData({
    source: filterState.source === SourceType.ALL ? undefined : filterState.source,
    district: filterState.district,
    category: filterState.category,
    includeParking: filterState.mapLayers.showParking,
    includeDistricts: filterState.mapLayers.showDistricts || !!filterState.district,
    limit: filterState.source === SourceType.SACHSEN ? 500 : 200, // Smart limits
  });

  // Search functionality
  const { searchResults, loading: searchLoading, search, clearSearch } = useSearch();

  // Handle search with performance optimizations
  const handleSearch = (query: string) => {
    setFilterState((prev) => ({ ...prev, search: query }));
    if (query.trim()) {
      search(query, filterState.category, filterState.district);
    } else {
      clearSearch();
    }
  };

  // Update filter handlers
  const updateFilter = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
    if (updates.search === "") {
      clearSearch();
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterState({
      category: undefined,
      source: SourceType.CHEMNITZ,
      district: undefined,
      search: "",
      mapLayers: {
        showCulturalSites: true,
        showParking: false,
        showDistricts: false,
      },
    });
    clearSearch();
  };

  // Determine what sites to display
  const displaySites = filterState.search ? searchResults : sites;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Enhanced Hero Header with Quick Stats */}
      <header className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden mb-6">
        {/* Hero Decoration (you can keep your existing icons/graphics here) */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 p-6 max-w-7xl mx-auto">
          {quickStats && (
            <div className="text-sm text-white">
              <p>
                Database: {quickStats.total_sites.toLocaleString()} sites •{" "}
                {quickStats.total_parking} parking lots •{" "}
                {quickStats.total_districts} districts
              </p>
              <p>Explore Chemnitz cultural heritage below ⬇️</p>
            </div>
          )}
        </div>
      </header>

      {/* ChemnitzMap Component with all props */}
      <ChemnitzMap
        // Map data
        culturalSites={displaySites}
        parkingLots={filterState.mapLayers.showParking ? parking : []}
        districts={filterState.mapLayers.showDistricts ? districts : []}
        loading={loadingState.sites || searchLoading}
        selectedDistrict={filterState.district}

        // Filter state and handlers
        filterState={filterState}
        onFilterUpdate={updateFilter}
        onClearAllFilters={clearAllFilters}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        onRefresh={refetchMapData}

        // Additional data for filters
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        districtNames={districtNames}
        districtsLoading={districtsLoading}
        districtsError={districtsError}

        // Search state
        searchResults={searchResults}
        searchLoading={searchLoading}

        // Errors
        mapError={mapError}

        // Loading states
        loadingState={loadingState}
      />

      {/* Enhanced Footer with Performance Stats */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center md:text-left">
              <p className="text-gray-300">
                © 2025 Chemnitz Cultural Explorer • Discover Saxony’s cultural heritage
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-400">
                Currently showing: {displaySites.length.toLocaleString()} sites
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

//
// 3) FINAL APP: wrap everything in <BrowserRouter> and <AuthProvider>
//
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Navbar at top */}
        <Navbar />

        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected “home” route (the map), only visible if user is logged in */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
          </Route>

          {/* You could add a “catch-all” 404 page: */}
          <Route
            path="*"
            element={
              <div className="p-8 text-center">
                <h2 className="text-2xl font-semibold mb-4">404: Page Not Found</h2>
                <Link to="/" className="text-blue-600 hover:underline">
                  Go back home
                </Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
