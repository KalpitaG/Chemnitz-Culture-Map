// components/Auth/AuthDebug.tsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const AuthDebug: React.FC = () => {
  const authState = useAuth();
  
  // Only show in development - check for development mode
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div><strong>Auth Debug:</strong></div>
      <div>Authenticated: {authState.isAuthenticated ? '✅' : '❌'}</div>
      <div>Loading: {authState.isLoading ? '⏳' : '✅'}</div>
      <div>User: {authState.user?.email || 'null'}</div>
      <div>Token: {localStorage.getItem('auth_token') ? '✅' : '❌'}</div>
      <div>Time: {new Date().toLocaleTimeString()}</div>
    </div>
  );
};

export default AuthDebug;