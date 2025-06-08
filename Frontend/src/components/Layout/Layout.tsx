/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Layout/Layout.tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  FilterState, 
  SourceType, 
  CategoryType,
  ParkingType 
} from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  filterState: FilterState;
  onFilterUpdate: (updates: Partial<FilterState>) => void;
  districtNames?: Array<{ id: string; name: string }>;
  districtsLoading?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  filterState,
  onFilterUpdate,
  districtNames = [],
  districtsLoading = false
}) => {
  const { user, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [parkingDropdownOpen, setParkingDropdownOpen] = useState(false);

  // Get user initials
  const getUserInitials = (user: any): string => {
    if (!user) return 'U';
    const firstInitial = user.first_name?.charAt(0)?.toUpperCase() || '';
    const lastInitial = user.last_name?.charAt(0)?.toUpperCase() || '';
    return firstInitial + lastInitial || user.email?.charAt(0)?.toUpperCase() || 'U';
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        console.log('🔐 Layout: Starting logout...');
        
        // Close dropdown first
        setUserDropdownOpen(false);
        
        // Call logout from auth hook
        await logout();
        
        console.log('✅ Layout: Logout completed');
        
        // Force page reload as backup (this ensures clean state)
        setTimeout(() => {
          window.location.reload();
        }, 100);
        
      } catch (error) {
        console.error('❌ Layout: Logout error:', error);
        
        // Even if there's an error, force logout
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } else {
      // User cancelled, just close dropdown
      setUserDropdownOpen(false);
    }
  };

  // Handle category filter changes
  const handleCategoryChange = (category: CategoryType, checked: boolean) => {
    const currentCategories = filterState.categories || [];
    let newCategories: CategoryType[];
    
    if (checked) {
      newCategories = [...currentCategories, category];
    } else {
      newCategories = currentCategories.filter(c => c !== category);
    }
    
    onFilterUpdate({ categories: newCategories });
  };

  // Handle parking filter changes
  const handleParkingChange = (parkingType: ParkingType, checked: boolean) => {
    const currentParking = filterState.parkingTypes || [];
    let newParking: ParkingType[];
    
    if (checked) {
      newParking = [...currentParking, parkingType];
    } else {
      newParking = currentParking.filter(p => p !== parkingType);
    }
    
    onFilterUpdate({ parkingTypes: newParking });
  };

  const isCategorySelected = (category: CategoryType): boolean => {
    return filterState.categories?.includes(category) || false;
  };

  const isParkingSelected = (parkingType: ParkingType): boolean => {
    return filterState.parkingTypes?.includes(parkingType) || false;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left Sidebar Placeholder */}
          <div className="w-64"></div>

          {/* Center Title */}
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-gray-800">
              <i className="fas fa-map-marked-alt mr-2 text-blue-600"></i>
              Chemnitz Cultural Explorer
            </h1>
          </div>

          {/* Right User Section */}
          <div className="w-64 flex justify-end">
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-3 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium text-sm">
                  {getUserInitials(user)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-800">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {user?.email}
                  </div>
                </div>
                <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      // TODO: Add favorites functionality
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <i className="fas fa-heart mr-3 text-red-500"></i>
                    Favorites
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      // TODO: Add account functionality
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <i className="fas fa-user mr-3 text-blue-500"></i>
                    Account
                  </button>
                  <hr className="my-2 border-gray-200" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* Location Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <i className="fas fa-map-marker-alt mr-2 text-blue-600"></i>
                Location
              </h3>
              
              {/* Location Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
                >
                  <span>
                    {filterState.source === SourceType.CHEMNITZ ? '🏛️ Chemnitz' : '🏰 Saxony'}
                  </span>
                  <i className={`fas fa-chevron-down transition-transform duration-200 ${locationDropdownOpen ? 'rotate-180' : ''}`}></i>
                </button>
                
                {locationDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        onFilterUpdate({ source: SourceType.CHEMNITZ });
                        setLocationDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                        filterState.source === SourceType.CHEMNITZ ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      🏛️ Chemnitz
                    </button>
                    <button
                      onClick={() => {
                        onFilterUpdate({ source: SourceType.SACHSEN, district: undefined });
                        setLocationDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                        filterState.source === SourceType.SACHSEN ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      🏰 Saxony
                    </button>
                  </div>
                )}
              </div>

              {/* District Dropdown (only for Chemnitz) */}
              {filterState.source === SourceType.CHEMNITZ && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">District</label>
                  <select
                    value={filterState.district || ''}
                    onChange={(e) => onFilterUpdate({ district: e.target.value || undefined })}
                    disabled={districtsLoading}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="">All Districts</option>
                    {districtNames.map((district) => (
                      <option key={district.id} value={district.name}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Filter Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <i className="fas fa-filter mr-2 text-green-600"></i>
                Filter
              </h3>
              
              <div className="relative">
                <button
                  onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
                >
                  <span>Cultural Sites</span>
                  <i className={`fas fa-chevron-down transition-transform duration-200 ${filterDropdownOpen ? 'rotate-180' : ''}`}></i>
                </button>
                
                {filterDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 p-4">
                    <div className="space-y-3">
                      {/* All Option */}
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!filterState.categories || filterState.categories.length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onFilterUpdate({ categories: [] });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">All</span>
                      </label>
                      
                      {/* Category Options */}
                      {Object.values(CategoryType).map((category) => (
                        <label key={category} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCategorySelected(category)}
                            onChange={(e) => handleCategoryChange(category, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 capitalize">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Parking Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <i className="fas fa-parking mr-2 text-purple-600"></i>
                Parking
              </h3>
              
              <div className="relative">
                <button
                  onClick={() => setParkingDropdownOpen(!parkingDropdownOpen)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
                >
                  <span>Parking Options</span>
                  <i className={`fas fa-chevron-down transition-transform duration-200 ${parkingDropdownOpen ? 'rotate-180' : ''}`}></i>
                </button>
                
                {parkingDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 p-4">
                    <div className="space-y-3">
                      {Object.values(ParkingType).map((parkingType) => (
                        <label key={parkingType} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isParkingSelected(parkingType)}
                            onChange={(e) => handleParkingChange(parkingType, e.target.checked)}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 capitalize flex items-center">
                            {parkingType === ParkingType.BUS ? '🚌' : '🚐'} {parkingType}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;