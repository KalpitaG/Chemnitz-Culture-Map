import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/App.css';

import Header from './Components/Header';
import Footer from './Components/Footer';
import SearchBar from './Components/SearchBar';
import ChemnitzMap from './Components/Map';
import Legend from './Components/Legend';

import {
  FilterState,
  SourceType,
  CategoryType,
} from './types';

import {
  useDistrictNames,
  useCategories,
  useSearch,
  useMapData
} from './hooks/useApi';

const App: React.FC = () => {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    source: SourceType.CHEMNITZ,
    district: undefined,
    category: undefined,
    mapLayers: {
      showParking: true,
      showDistricts: true,
      showCulturalSites: true,
    },
  });

  const onFilterUpdate = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const onClearAllFilters = () => {
    setFilterState({
      search: '',
      source: SourceType.CHEMNITZ,
      district: undefined,
      category: undefined,
      mapLayers: {
        showParking: true,
        showDistricts: true,
        showCulturalSites: true,
      },
    });
  };

  const onSearch = (query: string) => {
    setFilterState((prev) => ({ ...prev, search: query }));
  };

  const onClearSearch = () => {
    setFilterState((prev) => ({ ...prev, search: '' }));
  };

  const onRefresh = () => {
    window.location.reload(); // placeholder
  };

  // API hooks
  const {
    data: districtNames,
    loading: districtsLoading,
    error: districtsError
  } = useDistrictNames();

  const {
    data: categories,
    loading: categoriesLoading,
    error: categoriesError
  } = useCategories();

  const {
    searchResults,
    loading: searchLoading
  } = useSearch();

  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError,
    refetch
  } = useMapData({
    source: filterState.source !== SourceType.SACHSEN ? filterState.source : undefined,
    district: filterState.district,
    category: filterState.category,
    includeParking: filterState.mapLayers.showParking,
    includeDistricts: filterState.mapLayers.showDistricts,
    includeChemnitzWhenSaxony: filterState.source === SourceType.SACHSEN
  });

  return (
    <div className="App bg-dark text-white d-flex flex-column min-vh-100 w-100">
      <Header />

      <div className="container-fluid flex-grow-1 py-3">
        <div className="row">
          {/* Main Map + Filters */}
          <div className="col-12">
            <SearchBar value={filterState.search} onChange={onSearch} />
            <ChemnitzMap
              culturalSites={sites}
              parkingLots={parking}
              districts={districts}
              loading={loadingState.sites}
              selectedDistrict={filterState.district}
              filterState={filterState}
              onFilterUpdate={onFilterUpdate}
              onClearAllFilters={onClearAllFilters}
              onSearch={onSearch}
              onClearSearch={onClearSearch}
              onRefresh={refetch}
              categories={(categories?.map(c => c.name) as CategoryType[]) || Object.values(CategoryType)}
              categoriesLoading={categoriesLoading}
              categoriesError={categoriesError}
              districtNames={districtNames || []}
              districtsLoading={districtsLoading}
              districtsError={districtsError}
              searchResults={searchResults}
              searchLoading={searchLoading}
              mapError={mapError}
              loadingState={loadingState}
            />
            <Legend />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default App;
