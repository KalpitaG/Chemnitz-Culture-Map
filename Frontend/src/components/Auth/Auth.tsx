// components/Auth/Auth.tsx
import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import './Auth.css'; // We'll create this for additional styling

type AuthMode = 'login' | 'register';

interface AuthProps {
  onAuthSuccess?: () => void;
  initialMode?: AuthMode;
}

export const Auth: React.FC<AuthProps> = ({ 
  onAuthSuccess, 
  initialMode = 'login' 
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleSwitchToLogin = () => setMode('login');
  const handleSwitchToRegister = () => setMode('register');

  const handleAuthSuccess = () => {
    if (onAuthSuccess) {
      onAuthSuccess();
    }
  };

  return (
    <div className="auth-container">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="auth-wrapper">
              <div className="text-center mb-4">
                <h2 className="app-title">
                  <i className="fas fa-map-marked-alt me-2 text-primary"></i>
                  Chemnitz Cultural Explorer
                </h2>
                <p className="text-muted">
                  Discover the cultural treasures of Chemnitz
                </p>
              </div>

              {mode === 'login' ? (
                <LoginForm
                  onSwitchToRegister={handleSwitchToRegister}
                  onSuccess={handleAuthSuccess}
                />
              ) : (
                <RegisterForm
                  onSwitchToLogin={handleSwitchToLogin}
                  onSuccess={handleAuthSuccess}
                />
              )}

              <div className="text-center mt-4">
                <small className="text-muted">
                  Secure authentication powered by JWT
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};