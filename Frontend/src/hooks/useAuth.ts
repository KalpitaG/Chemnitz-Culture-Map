/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { apiService, LoginCredentials, RegisterData, User, tokenManager } from '../services/api';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = () => {
      const token = tokenManager.getToken();
      const user = tokenManager.getUser();
      
      if (token && user) {
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    };

    initAuth();

    // Listen for logout events (e.g., from token expiration)
    const handleLogout = () => {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    };

    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      console.log('🔐 Starting login process...');
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const authResponse = await apiService.login(credentials);
      console.log('✅ API login successful:', authResponse.user.email);
      
      // Update state with new user data
      const newAuthState = {
        user: authResponse.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
      
      console.log('🔄 Updating auth state:', newAuthState);
      setAuthState(newAuthState);
      
      // Force a React re-render by updating state multiple times if needed
      setTimeout(() => {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user: authResponse.user
        }));
        console.log('🔄 Force state update completed');
      }, 50);
      
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed'
      }));
      throw error;
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const authResponse = await apiService.register(userData);
      
      setAuthState({
        user: authResponse.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Registration failed'
      }));
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🔐 Starting logout process...');
      
      // First, update state to show we're logging out
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Call API logout
      await apiService.logout();
      
      console.log('✅ API logout successful');
    } catch (error) {
      console.error('❌ Logout API error:', error);
    } finally {
      // Always clear authentication state, regardless of API success/failure
      console.log('🧹 Clearing authentication state...');
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
      
      // Force a React re-render by dispatching a storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth_token',
        newValue: null,
        oldValue: localStorage.getItem('auth_token')
      }));
      
      console.log('✅ Logout completed - should redirect to login');
    }
  };

  const clearError = (): void => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (!authState.isAuthenticated) return;
      
      const user = await apiService.getCurrentUser();
      setAuthState(prev => ({ ...prev, user }));
    } catch (error: any) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, user might need to login again
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please login again.'
      });
    }
  };

  return {
    ...authState,
    login,
    register,
    logout,
    clearError,
    refreshUser
  };
};