/* src/services/authService.ts */
import api from "./api"; 
import jwtDecode from "jwt-decode";

//
// 1) Define the shapes of payloads & responses
//
export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: UserInfo;
}

//
// 2) Register function (calls POST /api/auth/register)
//
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/api/auth/register", payload);
  return response.data;
}

//
// 3) Login function (calls POST /api/auth/login)
//
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/api/auth/login", payload);
  return response.data;
}

//
// 4) Utility to decode JWT (if you want to pull out expiration, username, etc.)
//
export function decodeToken(token: string): any {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

//
// 5) Logout is really just removing the token from localStorage;
//    we’ll implement that in our AuthContext. 
//
