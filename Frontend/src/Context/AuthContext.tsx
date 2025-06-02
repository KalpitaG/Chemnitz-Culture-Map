/* src/context/AuthContext.tsx */
import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { register, login, AuthResponse, decodeToken } from "../services/auth";
import api from "../services/api"; // so we can set the Authorization header on every request
import { useNavigate } from "react-router-dom";

// --------------- 1) TYPES & CONTEXT CREATION ----------------

interface AuthContextType {
  user: AuthResponse["user"] | null;
  token: string | null;
  loading: boolean;
  signup: (data: { email: string; password: string; first_name: string; last_name: string; }) => Promise<void>;
  signin: (data: { email: string; password: string; }) => Promise<void>;
  signout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signup: async () => {},
  signin: async () => {},
  signout: () => {},
  isAuthenticated: false
});

export function useAuth() {
  return useContext(AuthContext);
}

// --------------- 2) HELPERS FOR LOCALSTORAGE ----------------

// Keys we'll use in localStorage
const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

function getTokenFromStorage(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getUserFromStorage(): AuthResponse["user"] | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }
  return null;
}

function setSession(token: string, user: AuthResponse["user"]) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Also set the default Authorization header for all future api calls:
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  delete api.defaults.headers.common["Authorization"];
}

// --------------- 3) AUTH CONTEXT PROVIDER ----------------

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, look at localStorage to see if we already have a token & user:
  useEffect(() => {
    const storedToken = getTokenFromStorage();
    const storedUser = getUserFromStorage();

    if (storedToken && storedUser) {
      // Optionally, check if token is expired (using decodeToken) before accepting it:
      // const decoded: any = decodeToken(storedToken);
      // if (decoded && decoded.exp * 1000 < Date.now()) {  // expired
      //   clearSession();
      //   setToken(null);
      //   setUser(null);
      // } else {
      setSession(storedToken, storedUser);
      setToken(storedToken);
      setUser(storedUser);
      // }
    }
    setLoading(false);
  }, []);

  // --------- signup() and signin() implementations ---------

  async function signup(data: { email: string; password: string; first_name: string; last_name: string; }) {
    setLoading(true);
    try {
      const response: AuthResponse = await register(data);
      setSession(response.access_token, response.user);
      setToken(response.access_token);
      setUser(response.user);
      navigate("/"); // Redirect to home (the map) after signup
    } catch (err) {
      setLoading(false);
      throw err; // Let the component handle displaying the error
    }
  }

  async function signin(data: { email: string; password: string; }) {
    setLoading(true);
    try {
      const response: AuthResponse = await login(data);
      setSession(response.access_token, response.user);
      setToken(response.access_token);
      setUser(response.user);
      navigate("/"); // Redirect to home (the map) after login
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }

  function signout() {
    clearSession();
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  const value: AuthContextType = {
    user,
    token,
    loading,
    signup,
    signin,
    signout,
    isAuthenticated: !!user && !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --------------- 4) PROTECTED ROUTE COMPONENT ----------------

// This component will wrap any route that should only be visible to authenticated users.
// If not logged in, redirects to /login.
import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Optionally render a spinner or placeholder
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

