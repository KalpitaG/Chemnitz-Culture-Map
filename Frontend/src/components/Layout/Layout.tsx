/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Layout/Layout.tsx - FIXED VERSION WITH SAXONY DROPDOWN
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

  // Refs for dropdown positioning
  const locationButtonRef = useRef<HTMLButtonElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationButtonRef.current && !locationButtonRef.current.contains(event.target as Node)) {
        setLocationDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

    console.log('🎭 Category change:', { category, checked, newCategories });
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

    console.log('🚗 Parking change:', { parkingType, checked, newParking });
    onFilterUpdate({ parkingTypes: newParking });
  };

  const isCategorySelected = (category: CategoryType): boolean => {
    return filterState.categories?.includes(category) || false;
  };

  const isParkingSelected = (parkingType: ParkingType): boolean => {
    return filterState.parkingTypes?.includes(parkingType) || false;
  };

  // FIXED: Helper function to get location display text
  const getLocationDisplayText = (): string => {
    switch (filterState.source) {
      case SourceType.CHEMNITZ:
        return '🏛️ Chemnitz Only';
      case SourceType.SACHSEN:
        return '🏰 All Saxony';
      default:
        return '🏛️ Chemnitz Only';
    }
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
              <span style={{ marginRight: '0.5rem', fontSize: '1.5rem' }}>🔍</span>
              Chemnitz Cultural Explorer
            </h1>
          </div>

          {/* Right User Section */}
          <div className="header-right-section">
            <div className="user-dropdown-container" ref={userDropdownRef}>
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
                <span style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}>🧭</span>
                Map Region
              </h3>

              <div className="checkbox-list-container">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Chemnitz Toggle Button */}
                  <button
                    onClick={() => {
                      console.log('📍 Switching to Chemnitz Only');
                      onFilterUpdate({
                        source: SourceType.CHEMNITZ,
                        district: undefined
                      });
                    }}
                    style={{
                      padding: '12px 16px',
                      border: `2px solid ${filterState.source === SourceType.CHEMNITZ ? '#2563eb' : '#d1d5db'}`,
                      borderRadius: '8px',
                      background: filterState.source === SourceType.CHEMNITZ ? '#eff6ff' : 'white',
                      color: filterState.source === SourceType.CHEMNITZ ? '#1d4ed8' : '#374151',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: filterState.source === SourceType.CHEMNITZ ? '600' : '400',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🏛️ Chemnitz Only
                  </button>

                  {/* Saxony Toggle Button */}
                  <button
                    onClick={() => {
                      console.log('🏰 Switching to All Saxony');
                      onFilterUpdate({
                        source: SourceType.SACHSEN,
                        district: undefined
                      });
                    }}
                    style={{
                      padding: '12px 16px',
                      border: `2px solid ${filterState.source === SourceType.SACHSEN ? '#2563eb' : '#d1d5db'}`,
                      borderRadius: '8px',
                      background: filterState.source === SourceType.SACHSEN ? '#eff6ff' : 'white',
                      color: filterState.source === SourceType.SACHSEN ? '#1d4ed8' : '#374151',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: filterState.source === SourceType.SACHSEN ? '600' : '400',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🏰 All Saxony
                  </button>


                </div>
              </div>

              {/* District Dropdown (only for Chemnitz) */}
              {filterState.source === SourceType.CHEMNITZ && (
                <div className="district-container">
                  <h3 className="section-title">
                    <span style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}>🏙️</span>
                    District
                  </h3>
                  <select
                    value={filterState.district || ''}
                    onChange={(e) => {
                      console.log('🏘️ District change:', e.target.value);
                      onFilterUpdate({ district: e.target.value || undefined });
                    }}
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

              {/* Show info when Saxony is selected */}
              {filterState.source === SourceType.SACHSEN && (
                <div className="district-container">
                  <div style={{
                    padding: '8px',
                    background: '#e3f2fd',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#1565c0'
                  }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i>
                    Showing all cultural sites across Saxony region including Chemnitz
                  </div>
                </div>
              )}
            </div>

            {/* Filter Section */}
            <div className="section">
              <h3 className="section-title">
                <span style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}>🎪</span>
                Cultural Sites
              </h3>

              <div className="checkbox-list-container">
                <div className="checkbox-list">
                  {/* All Option */}
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={!filterState.categories || filterState.categories.length === 0 || filterState.categories.length === Object.keys(CategoryType).length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          console.log('🎭 Selecting all categories');
                          onFilterUpdate({ categories: Object.values(CategoryType) });
                        } else {
                          console.log('🎭 Deselecting all categories');
                          onFilterUpdate({ categories: [] });
                        }
                      }}
                      className="checkbox-input blue"
                    />
                    <span className="checkbox-label bold">
                      <span style={{ marginRight: '8px', fontSize: '1rem' }}>✨</span>
                      All
                    </span>
                  </label>

                  {/* Category Options with colorful emojis */}
                  {(Object.values(CategoryType) as CategoryType[]).map((category) => {
                    const getCategoryIcon = (cat: CategoryType) => {
                      switch (cat) {
                        case CategoryType.THEATRE: return '🎭';
                        case CategoryType.MUSEUM: return '🏺';
                        case CategoryType.RESTAURANT: return '🍽️';
                        case CategoryType.ARTWORK: return '🎨';
                        default: return '📍';
                      }
                    };

                    const getCategoryName = (cat: CategoryType) => {
                      return cat.charAt(0).toUpperCase() + cat.slice(1);
                    };

                    return (
                      <label key={category} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={isCategorySelected(category)}
                          onChange={(e) => handleCategoryChange(category, e.target.checked)}
                          className="checkbox-input blue"
                        />
                        <span className="checkbox-label">
                          <span style={{ marginRight: '8px', fontSize: '1rem' }}>{getCategoryIcon(category)}</span>
                          {getCategoryName(category)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Parking Section */}
            <div className="section">
              <h3 className="section-title">
                <span style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}>🅿️</span>
                Parking Options
              </h3>

              <div className="checkbox-list-container">
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
                        <span style={{ marginRight: '8px', fontSize: '1rem' }}>
                          {parkingType === ParkingType.BUS ? '🚌' : '🚐'}
                        </span>
                        {parkingType === ParkingType.BUS ? 'Bus' : 'Caravan'}
                      </span>
                    </label>
                  ))}
                </div>
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