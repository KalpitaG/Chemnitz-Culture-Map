/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Layout/Layout.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  FilterState, 
  SourceType, 
  CategoryType,
  ParkingType 
} from '../../types';
import './Layout.css';

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

  // Refs for dropdown positioning
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const parkingButtonRef = useRef<HTMLButtonElement>(null);
  const locationButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterButtonRef.current && !filterButtonRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
      if (parkingButtonRef.current && !parkingButtonRef.current.contains(event.target as Node)) {
        setParkingDropdownOpen(false);
      }
      if (locationButtonRef.current && !locationButtonRef.current.contains(event.target as Node)) {
        setLocationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close other dropdowns when opening one
  const handleDropdownToggle = (
    dropdownSetter: React.Dispatch<React.SetStateAction<boolean>>,
    currentState: boolean
  ) => {
    setUserDropdownOpen(false);
    setLocationDropdownOpen(false);
    setFilterDropdownOpen(false);
    setParkingDropdownOpen(false);
    dropdownSetter(!currentState);
  };

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

  // Function to get dropdown position
  const getDropdownStyle = useCallback((buttonRef: React.RefObject<HTMLButtonElement>) => {
    if (!buttonRef.current) return {};
    
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      position: 'fixed' as const,
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 9999
    };
  }, []);

  const isParkingSelected = (parkingType: ParkingType): boolean => {
    return filterState.parkingTypes?.includes(parkingType) || false;
  };

  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-content">
          {/* Left Sidebar Placeholder */}
          <div className="header-left-placeholder"></div>

          {/* Center Title */}
          <div className="header-title-container">
            <h1 className="header-title">
              <i className="fas fa-map-marked-alt header-title-icon"></i>
              Chemnitz Cultural Explorer
            </h1>
          </div>

          {/* Right User Section */}
          <div className="header-right-section">
            <div className="user-dropdown-container">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="user-button"
              >
                <div className="user-avatar">
                  {getUserInitials(user)}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="user-email">
                    {user?.email}
                  </div>
                </div>
                <i className={`fas fa-chevron-down user-chevron ${userDropdownOpen ? 'open' : ''}`}></i>
              </button>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="user-dropdown-menu">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      // TODO: Add account functionality
                    }}
                    className="user-dropdown-item account"
                  >
                    <i className="fas fa-user user-dropdown-icon account"></i>
                    Account
                  </button>
                  <hr className="user-dropdown-divider" />
                  <button
                    onClick={handleLogout}
                    className="user-dropdown-item logout"
                  >
                    <i className="fas fa-sign-out-alt user-dropdown-icon"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-content">
            
            {/* Location Section */}
            <div className="section">
              <h3 className="section-title">
                <i className="fas fa-map-marker-alt section-icon location"></i>
                Location
              </h3>
              
              {/* Location Dropdown */}
              <div className="dropdown-container">
                <button
                  ref={locationButtonRef}
                  onClick={() => handleDropdownToggle(setLocationDropdownOpen, locationDropdownOpen)}
                  className="dropdown-button"
                >
                  <span>
                    {filterState.source === SourceType.CHEMNITZ ? '🏛️ Chemnitz' : '🏰 Saxony'}
                  </span>
                  <i className={`fas fa-chevron-down dropdown-chevron ${locationDropdownOpen ? 'open' : ''}`}></i>
                </button>
                
                {locationDropdownOpen && (
                  <div className="dropdown-menu location">
                    <button
                      onClick={() => {
                        onFilterUpdate({ source: SourceType.CHEMNITZ });
                        setLocationDropdownOpen(false);
                      }}
                      className={`dropdown-item ${
                        filterState.source === SourceType.CHEMNITZ ? 'active' : 'inactive'
                      }`}
                    >
                      🏛️ Chemnitz
                    </button>
                    <button
                      onClick={() => {
                        onFilterUpdate({ source: SourceType.SACHSEN, district: undefined });
                        setLocationDropdownOpen(false);
                      }}
                      className={`dropdown-item ${
                        filterState.source === SourceType.SACHSEN ? 'active' : 'inactive'
                      }`}
                    >
                      🏰 Saxony
                    </button>
                  </div>
                )}
              </div>

              {/* District Dropdown (only for Chemnitz) */}
              {filterState.source === SourceType.CHEMNITZ && (
                <div className="district-container">
                  <label className="district-label">District</label>
                  <select
                    value={filterState.district || ''}
                    onChange={(e) => onFilterUpdate({ district: e.target.value || undefined })}
                    disabled={districtsLoading}
                    className="district-select"
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
            <div className="section">
              <h3 className="section-title">
                <i className="fas fa-filter section-icon filter"></i>
                Filter
              </h3>
              
              <div className="dropdown-container">
                <button
                  ref={filterButtonRef}
                  onClick={() => handleDropdownToggle(setFilterDropdownOpen, filterDropdownOpen)}
                  className="dropdown-button"
                >
                  <span>Cultural Sites</span>
                  <i className={`fas fa-chevron-down dropdown-chevron ${filterDropdownOpen ? 'open' : ''}`}></i>
                </button>
                
                {filterDropdownOpen && (
                  <div className="dropdown-menu filter">
                    <div className="checkbox-list">
                      {/* All Option */}
                      <label className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={!filterState.categories || filterState.categories.length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onFilterUpdate({ categories: [] });
                            }
                          }}
                          className="checkbox-input blue"
                        />
                        <span className="checkbox-label bold">All</span>
                      </label>
                      
                      {/* Category Options */}
                      {(Object.values(CategoryType) as CategoryType[]).map((category) => (
                        <label key={category} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={isCategorySelected(category)}
                            onChange={(e) => handleCategoryChange(category, e.target.checked)}
                            className="checkbox-input blue"
                          />
                          <span className="checkbox-label">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Parking Section */}
            <div className="section">
              <h3 className="section-title">
                <i className="fas fa-parking section-icon parking"></i>
                Parking
              </h3>
              
              <div className="dropdown-container">
                <button
                  ref={parkingButtonRef}
                  onClick={() => handleDropdownToggle(setParkingDropdownOpen, parkingDropdownOpen)}
                  className="dropdown-button"
                >
                  <span>Parking Options</span>
                  <i className={`fas fa-chevron-down dropdown-chevron ${parkingDropdownOpen ? 'open' : ''}`}></i>
                </button>
                
                {parkingDropdownOpen && (
                  <div className="dropdown-menu parking">
                    <div className="checkbox-list">
                      {(Object.values(ParkingType) as ParkingType[]).map((parkingType) => (
                        <label key={parkingType} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={isParkingSelected(parkingType)}
                            onChange={(e) => handleParkingChange(parkingType, e.target.checked)}
                            className="checkbox-input purple"
                          />
                          <span className="checkbox-label">
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
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;