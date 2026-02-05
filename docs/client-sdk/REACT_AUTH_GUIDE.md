# React Authentication Guide (TypeScript)

Complete guide for implementing authentication in React/TypeScript applications using the Skaftin backend with SuperTokens session management.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Project Setup](#project-setup)
4. [Token Management](#token-management)
5. [HTTP Client with Auto-Refresh](#http-client-with-auto-refresh)
6. [Auth Store (Zustand)](#auth-store-zustand)
7. [Auth Provider & Hook](#auth-provider--hook)
8. [Protected Routes](#protected-routes)
9. [Login & Registration Forms](#login--registration-forms)
10. [Session Persistence](#session-persistence)
11. [Advanced Patterns](#advanced-patterns)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your React App                           │
├─────────────────────────────────────────────────────────────────┤
│  AuthProvider (Context)                                         │
│    ├── useAuth() hook                                           │
│    ├── Token Management (localStorage/memory)                   │
│    └── Auto-refresh on 401                                      │
├─────────────────────────────────────────────────────────────────┤
│  SkaftinClient (Axios)                                          │
│    ├── Automatic Bearer token injection                         │
│    ├── 401 interceptor → refresh token → retry                  │
│    └── API key header injection                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Skaftin Backend                            │
│  /app-api/auth/auth/login    → Returns accessToken              │
│  /app-api/auth/auth/register → Returns accessToken              │
│  /app-api/auth/auth/verify   → Validates session                │
│  /auth/session/refresh       → Refreshes expired token          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **Persistent Sessions**: Users stay logged in across page refreshes and browser restarts
- **Automatic Token Refresh**: Expired tokens are refreshed transparently
- **Type Safety**: Full TypeScript support throughout
- **Flexible Storage**: Choose localStorage, sessionStorage, or memory-only
- **Role-Based Access**: Built-in support for role checking

---

## Quick Start

### 1. Install Dependencies

```bash
npm install axios zustand
# or
yarn add axios zustand
# or
pnpm add axios zustand
```

### 2. Set Up Environment Variables

```env
# .env or .env.local
VITE_SKAFTIN_API_URL=https://your-skaftin-instance.com
VITE_SKAFTIN_API_KEY=sk_your_api_key_here
```

### 3. Create the Auth System

Copy the files from this guide into your project:

```
src/
├── config/
│   └── skaftin.config.ts
├── services/
│   ├── TokenManager.ts
│   ├── SkaftinClient.ts
│   └── AuthService.ts
├── stores/
│   └── authStore.ts
├── hooks/
│   └── useAuth.ts
├── components/
│   ├── AuthProvider.tsx
│   └── ProtectedRoute.tsx
└── pages/
    └── LoginPage.tsx
```

---

## Project Setup

### Configuration File

Create `src/config/skaftin.config.ts`:

```typescript
// src/config/skaftin.config.ts

export const SKAFTIN_CONFIG = {
  // API URL - your Skaftin backend instance
  apiUrl: import.meta.env.VITE_SKAFTIN_API_URL || 'http://localhost:3000',
  
  // API Key - identifies your project (get from Skaftin dashboard)
  apiKey: import.meta.env.VITE_SKAFTIN_API_KEY || '',
  
  // Token storage key
  tokenStorageKey: 'skaftin_access_token',
  
  // User storage key  
  userStorageKey: 'skaftin_user',
  
  // Session check interval (ms) - how often to verify session is valid
  sessionCheckInterval: 5 * 60 * 1000, // 5 minutes
  
  // Token refresh buffer (ms) - refresh token this much before expiry
  tokenRefreshBuffer: 60 * 1000, // 1 minute
} as const;

export type SkaftinConfig = typeof SKAFTIN_CONFIG;
```

---

## Token Management

### Token Manager

Create `src/services/TokenManager.ts`:

```typescript
// src/services/TokenManager.ts

import { SKAFTIN_CONFIG } from '../config/skaftin.config';

export type StorageType = 'localStorage' | 'sessionStorage' | 'memory';

interface TokenManagerOptions {
  storageType?: StorageType;
  tokenKey?: string;
  userKey?: string;
}

class TokenManagerClass {
  private storageType: StorageType = 'localStorage';
  private tokenKey: string;
  private userKey: string;
  
  // Memory storage fallback (for SSR or when localStorage is unavailable)
  private memoryStore: Map<string, string> = new Map();

  constructor(options: TokenManagerOptions = {}) {
    this.storageType = options.storageType || 'localStorage';
    this.tokenKey = options.tokenKey || SKAFTIN_CONFIG.tokenStorageKey;
    this.userKey = options.userKey || SKAFTIN_CONFIG.userStorageKey;
  }

  /**
   * Configure storage type at runtime
   */
  setStorageType(type: StorageType): void {
    this.storageType = type;
  }

  /**
   * Get the storage mechanism based on configuration
   */
  private getStorage(): Storage | Map<string, string> {
    if (typeof window === 'undefined') {
      return this.memoryStore;
    }

    switch (this.storageType) {
      case 'localStorage':
        return window.localStorage;
      case 'sessionStorage':
        return window.sessionStorage;
      case 'memory':
        return this.memoryStore;
      default:
        return window.localStorage;
    }
  }

  /**
   * Get item from storage
   */
  private getItem(key: string): string | null {
    const storage = this.getStorage();
    if (storage instanceof Map) {
      return storage.get(key) || null;
    }
    return storage.getItem(key);
  }

  /**
   * Set item in storage
   */
  private setItem(key: string, value: string): void {
    const storage = this.getStorage();
    if (storage instanceof Map) {
      storage.set(key, value);
    } else {
      storage.setItem(key, value);
    }
  }

  /**
   * Remove item from storage
   */
  private removeItem(key: string): void {
    const storage = this.getStorage();
    if (storage instanceof Map) {
      storage.delete(key);
    } else {
      storage.removeItem(key);
    }
  }

  // ============================================
  // ACCESS TOKEN METHODS
  // ============================================

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.getItem(this.tokenKey);
  }

  /**
   * Store an access token
   */
  setAccessToken(token: string): void {
    this.setItem(this.tokenKey, token);
  }

  /**
   * Check if a token exists
   */
  hasToken(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Parse JWT token to get payload (without verification)
   * Note: This is for client-side inspection only, not security validation
   */
  parseToken(token?: string): Record<string, any> | null {
    const tokenToParse = token || this.getAccessToken();
    if (!tokenToParse) return null;

    try {
      const parts = tokenToParse.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(bufferMs: number = 0): boolean {
    const payload = this.parseToken();
    if (!payload || !payload.exp) return true;
    
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiryTime - bufferMs;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(): Date | null {
    const payload = this.parseToken();
    if (!payload || !payload.exp) return null;
    return new Date(payload.exp * 1000);
  }

  // ============================================
  // USER DATA METHODS
  // ============================================

  /**
   * Get stored user data
   */
  getUser<T = any>(): T | null {
    const userData = this.getItem(this.userKey);
    if (!userData) return null;
    
    try {
      return JSON.parse(userData) as T;
    } catch {
      return null;
    }
  }

  /**
   * Store user data
   */
  setUser<T = any>(user: T): void {
    this.setItem(this.userKey, JSON.stringify(user));
  }

  // ============================================
  // CLEAR METHODS
  // ============================================

  /**
   * Clear the access token
   */
  clearToken(): void {
    this.removeItem(this.tokenKey);
  }

  /**
   * Clear user data
   */
  clearUser(): void {
    this.removeItem(this.userKey);
  }

  /**
   * Clear all auth data (logout)
   */
  clearAll(): void {
    this.clearToken();
    this.clearUser();
  }
}

// Export singleton instance
export const TokenManager = new TokenManagerClass();

// Export class for custom instances
export { TokenManagerClass };
```

---

## HTTP Client with Auto-Refresh

### Skaftin Client

Create `src/services/SkaftinClient.ts`:

```typescript
// src/services/SkaftinClient.ts

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { SKAFTIN_CONFIG } from '../config/skaftin.config';
import { TokenManager } from './TokenManager';

// Extend the config type to include our retry flag
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  statusCode?: number;
}

export interface RefreshResponse {
  status: string;
  accessToken?: string;
}

class SkaftinClientClass {
  private client: AxiosInstance;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: SKAFTIN_CONFIG.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - add auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Add API key header
        if (SKAFTIN_CONFIG.apiKey) {
          config.headers['X-API-Key'] = SKAFTIN_CONFIG.apiKey;
        }

        // Add Bearer token if available
        const token = TokenManager.getAccessToken();
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 and refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        // If no config or already retried, reject
        if (!originalRequest || originalRequest._retry) {
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          // Don't refresh for auth endpoints (login, register, etc.)
          const isAuthEndpoint = originalRequest.url?.includes('/auth/auth/');
          if (isAuthEndpoint) {
            return Promise.reject(error);
          }

          // If already refreshing, queue this request
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshAccessToken();
            
            if (newToken) {
              TokenManager.setAccessToken(newToken);
              
              // Notify all queued requests
              this.refreshSubscribers.forEach((callback) => callback(newToken));
              this.refreshSubscribers = [];

              // Retry original request
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed - clear auth and redirect to login
            TokenManager.clearAll();
            this.refreshSubscribers = [];
            
            // Dispatch event for auth state listeners
            window.dispatchEvent(new CustomEvent('auth:logout', { 
              detail: { reason: 'session_expired' } 
            }));
            
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(): Promise<string | null> {
    const currentToken = TokenManager.getAccessToken();
    
    if (!currentToken) {
      return null;
    }

    try {
      // SuperTokens refresh endpoint
      const response = await axios.post<RefreshResponse>(
        `${SKAFTIN_CONFIG.apiUrl}/auth/session/refresh`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'X-API-Key': SKAFTIN_CONFIG.apiKey,
          },
        }
      );

      if (response.data.status === 'OK' && response.data.accessToken) {
        return response.data.accessToken;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  /**
   * GET request
   */
  async get<T = any>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data;
  }

  /**
   * Get the underlying axios instance (for advanced use)
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const SkaftinClient = new SkaftinClientClass();

// Export class for custom instances
export { SkaftinClientClass };
```

---

## Auth Store (Zustand)

### Auth Store with Persistence

Create `src/stores/authStore.ts`:

```typescript
// src/stores/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TokenManager } from '../services/TokenManager';
import { SkaftinClient, ApiResponse } from '../services/SkaftinClient';

// Types
export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
  permissions?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  metadata?: Record<string, any>;
  otp_method?: 'email' | 'sms' | null;
}

export interface AuthState {
  // State
  user: AppUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresOtpVerification: boolean;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<{ success: boolean; requiresOtp: boolean }>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
  verifyOtp: (code: string, userIdOrEmail: number | string) => Promise<boolean>;
  clearError: () => void;
  setUser: (user: AppUser | null) => void;
  
  // Helpers
  hasRole: (roleKey: string) => boolean;
  hasAnyRole: (roleKeys: string[]) => boolean;
  hasAllRoles: (roleKeys: string[]) => boolean;
}

// API endpoints
const AUTH_ENDPOINTS = {
  login: '/app-api/auth/auth/login',
  register: '/app-api/auth/auth/register',
  verify: '/app-api/auth/auth/verify',
  logout: '/app-api/auth/auth/logout',
  verifyOtp: '/app-api/auth/auth/verify-otp',
} as const;

// Create the store
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresOtpVerification: false,

      // ============================================
      // ACTIONS
      // ============================================

      /**
       * Login with email and password
       */
      login: async (credentials: LoginCredentials): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await SkaftinClient.post<{
            user: AppUser;
            session: { accessToken: string };
          }>(AUTH_ENDPOINTS.login, credentials);

          if (response.success && response.data) {
            const { user, session } = response.data;
            
            // Store token
            TokenManager.setAccessToken(session.accessToken);
            
            set({
              user,
              accessToken: session.accessToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return true;
          }

          set({
            isLoading: false,
            error: response.message || 'Login failed',
          });
          return false;
        } catch (error: any) {
          const message = error.response?.data?.message || 'Login failed';
          set({
            isLoading: false,
            error: message,
          });
          return false;
        }
      },

      /**
       * Register a new user
       */
      register: async (data: RegisterData): Promise<{ success: boolean; requiresOtp: boolean }> => {
        set({ isLoading: true, error: null });

        try {
          const response = await SkaftinClient.post<{
            user: AppUser;
            session: { accessToken: string };
            requires_otp_verification?: boolean;
          }>(AUTH_ENDPOINTS.register, data);

          if (response.success && response.data) {
            const { user, session, requires_otp_verification } = response.data;
            
            // Store token
            TokenManager.setAccessToken(session.accessToken);
            
            set({
              user,
              accessToken: session.accessToken,
              isAuthenticated: !requires_otp_verification,
              isLoading: false,
              error: null,
              requiresOtpVerification: requires_otp_verification || false,
            });

            return { 
              success: true, 
              requiresOtp: requires_otp_verification || false 
            };
          }

          set({
            isLoading: false,
            error: response.message || 'Registration failed',
          });
          return { success: false, requiresOtp: false };
        } catch (error: any) {
          const message = error.response?.data?.message || 'Registration failed';
          set({
            isLoading: false,
            error: message,
          });
          return { success: false, requiresOtp: false };
        }
      },

      /**
       * Logout - clear session
       */
      logout: async (): Promise<void> => {
        try {
          // Call logout endpoint to invalidate server session
          await SkaftinClient.post(AUTH_ENDPOINTS.logout);
        } catch (error) {
          // Continue with local logout even if server call fails
          console.error('Logout API call failed:', error);
        } finally {
          // Always clear local state
          TokenManager.clearAll();
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            error: null,
            requiresOtpVerification: false,
          });
        }
      },

      /**
       * Verify current session is valid
       */
      verifySession: async (): Promise<boolean> => {
        const token = TokenManager.getAccessToken();
        
        if (!token) {
          set({ isAuthenticated: false, user: null, accessToken: null });
          return false;
        }

        set({ isLoading: true });

        try {
          const response = await SkaftinClient.post<{ user: AppUser }>(
            AUTH_ENDPOINTS.verify
          );

          if (response.success && response.data) {
            set({
              user: response.data.user,
              accessToken: token,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }

          // Session invalid - clear everything
          TokenManager.clearAll();
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        } catch (error) {
          // Session verification failed
          TokenManager.clearAll();
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      /**
       * Verify OTP code (for registration or password reset)
       */
      verifyOtp: async (code: string, userIdOrEmail: number | string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const body = typeof userIdOrEmail === 'number' 
            ? { user_id: userIdOrEmail, code }
            : { email: userIdOrEmail, code };

          const response = await SkaftinClient.post(AUTH_ENDPOINTS.verifyOtp, body);

          if (response.success) {
            set({
              isAuthenticated: true,
              requiresOtpVerification: false,
              isLoading: false,
            });
            return true;
          }

          set({
            isLoading: false,
            error: response.message || 'OTP verification failed',
          });
          return false;
        } catch (error: any) {
          const message = error.response?.data?.message || 'OTP verification failed';
          set({
            isLoading: false,
            error: message,
          });
          return false;
        }
      },

      /**
       * Clear any error state
       */
      clearError: () => set({ error: null }),

      /**
       * Manually set user (for updates)
       */
      setUser: (user: AppUser | null) => set({ user }),

      // ============================================
      // ROLE HELPERS
      // ============================================

      /**
       * Check if user has a specific role
       */
      hasRole: (roleKey: string): boolean => {
        const { user } = get();
        return user?.roles?.some((r) => r.role_key === roleKey) || false;
      },

      /**
       * Check if user has any of the specified roles
       */
      hasAnyRole: (roleKeys: string[]): boolean => {
        const { user } = get();
        return user?.roles?.some((r) => roleKeys.includes(r.role_key)) || false;
      },

      /**
       * Check if user has all of the specified roles
       */
      hasAllRoles: (roleKeys: string[]): boolean => {
        const { user } = get();
        if (!user?.roles) return false;
        return roleKeys.every((key) => 
          user.roles.some((r) => r.role_key === key)
        );
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist specific fields
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // Sync token manager on rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          TokenManager.setAccessToken(state.accessToken);
        }
      },
    }
  )
);

// Listen for auth:logout events (from SkaftinClient on session expiry)
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
  });
}
```

---

## Auth Provider & Hook

### Auth Provider Component

Create `src/components/AuthProvider.tsx`:

```typescript
// src/components/AuthProvider.tsx

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore, AppUser } from '../stores/authStore';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    metadata?: Record<string, any>;
    otp_method?: 'email' | 'sms' | null;
  }) => Promise<{ success: boolean; requiresOtp: boolean }>;
  logout: () => Promise<void>;
  verifyOtp: (code: string, userIdOrEmail: number | string) => Promise<boolean>;
  clearError: () => void;
  hasRole: (roleKey: string) => boolean;
  hasAnyRole: (roleKeys: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  /**
   * URL to redirect to after logout (optional)
   */
  loginPath?: string;
  /**
   * Whether to verify session on mount (default: true)
   */
  verifyOnMount?: boolean;
  /**
   * Loading component to show while initializing
   */
  loadingComponent?: ReactNode;
}

export function AuthProvider({
  children,
  loginPath = '/login',
  verifyOnMount = true,
  loadingComponent,
}: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    verifySession,
    verifyOtp,
    clearError,
    hasRole,
    hasAnyRole,
  } = useAuthStore();

  // Verify session on mount
  useEffect(() => {
    const initAuth = async () => {
      if (verifyOnMount) {
        await verifySession();
      }
      setIsInitialized(true);
    };

    initAuth();
  }, [verifyOnMount, verifySession]);

  // Show loading while initializing
  if (!isInitialized) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    verifyOtp,
    clearError,
    hasRole,
    hasAnyRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Hook to access auth state directly from store (without provider)
 * Useful for non-React contexts or when you need direct store access
 */
export function useAuthState() {
  return useAuthStore();
}
```

### Simple useAuth Hook (Alternative)

If you don't need the provider pattern, create `src/hooks/useAuth.ts`:

```typescript
// src/hooks/useAuth.ts

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * Simple auth hook that directly uses the Zustand store
 * Use this if you don't need the AuthProvider pattern
 */
export function useAuth() {
  const store = useAuthStore();

  // Verify session on first use
  useEffect(() => {
    if (!store.isAuthenticated && store.accessToken) {
      store.verifySession();
    }
  }, []);

  return {
    // State
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    requiresOtpVerification: store.requiresOtpVerification,

    // Actions
    login: store.login,
    register: store.register,
    logout: store.logout,
    verifySession: store.verifySession,
    verifyOtp: store.verifyOtp,
    clearError: store.clearError,

    // Role helpers
    hasRole: store.hasRole,
    hasAnyRole: store.hasAnyRole,
    hasAllRoles: store.hasAllRoles,
  };
}

export default useAuth;
```

---

## Protected Routes

### ProtectedRoute Component

Create `src/components/ProtectedRoute.tsx`:

```typescript
// src/components/ProtectedRoute.tsx

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Required roles (user must have at least one)
   */
  requiredRoles?: string[];
  /**
   * Require ALL roles instead of ANY
   */
  requireAllRoles?: boolean;
  /**
   * Redirect path for unauthenticated users
   */
  loginPath?: string;
  /**
   * Redirect path for unauthorized users (wrong role)
   */
  unauthorizedPath?: string;
  /**
   * Custom loading component
   */
  loadingComponent?: ReactNode;
  /**
   * Custom unauthorized component
   */
  unauthorizedComponent?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles = [],
  requireAllRoles = false,
  loginPath = '/login',
  unauthorizedPath = '/unauthorized',
  loadingComponent,
  unauthorizedComponent,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isInitialized, hasRole, hasAnyRole } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (!isInitialized || isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Check roles if specified
  if (requiredRoles.length > 0) {
    const hasRequiredRoles = requireAllRoles
      ? requiredRoles.every((role) => hasRole(role))
      : hasAnyRole(requiredRoles);

    if (!hasRequiredRoles) {
      if (unauthorizedComponent) {
        return <>{unauthorizedComponent}</>;
      }
      return <Navigate to={unauthorizedPath} replace />;
    }
  }

  return <>{children}</>;
}

/**
 * HOC for class components or simple wrapping
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
```

### Usage with React Router

```typescript
// src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected routes - any authenticated user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes - admin only */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes - admin or manager */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

---

## Login & Registration Forms

### Login Page

Create `src/pages/LoginPage.tsx`:

```typescript
// src/pages/LoginPage.tsx

import React, { useState, FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Get redirect path from location state
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await login({ email, password });
    
    if (success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Register
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Registration Page

Create `src/pages/RegisterPage.tsx`:

```typescript
// src/pages/RegisterPage.tsx

import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, verifyOtp, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone || undefined,
      otp_method: 'email', // Request OTP verification via email
    });

    if (result.success) {
      if (result.requiresOtp) {
        setShowOtpInput(true);
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await verifyOtp(otpCode, formData.email);
    
    if (success) {
      navigate('/dashboard');
    }
  };

  // OTP verification form
  if (showOtpInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Verify your email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've sent a verification code to {formData.email}
            </p>
          </div>

          <form onSubmit={handleOtpSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter 6-digit code"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {(error || localError) && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error || localError}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone (optional)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Session Persistence

### How Session Persistence Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     Session Lifecycle                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER LOGS IN                                                │
│     └── accessToken stored in localStorage                      │
│     └── user data stored in Zustand (persisted)                 │
│                                                                 │
│  2. USER CLOSES BROWSER                                         │
│     └── accessToken remains in localStorage                     │
│     └── Zustand state persisted to localStorage                 │
│                                                                 │
│  3. USER RETURNS LATER                                          │
│     └── App loads, Zustand rehydrates from localStorage         │
│     └── AuthProvider calls verifySession()                      │
│     └── If token valid → user is logged in                      │
│     └── If token expired → auto-refresh triggered               │
│     └── If refresh fails → user redirected to login             │
│                                                                 │
│  4. DURING APP USAGE                                            │
│     └── API call returns 401 (token expired)                    │
│     └── Interceptor catches 401                                 │
│     └── Calls /auth/session/refresh                             │
│     └── Gets new token, retries original request                │
│     └── User never notices interruption                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Options Comparison

| Storage Type | Persistence | Security | Use Case |
|--------------|-------------|----------|----------|
| `localStorage` | Survives browser close | XSS vulnerable | Default, best UX |
| `sessionStorage` | Tab only | XSS vulnerable | Per-tab sessions |
| `memory` | Page reload clears | Most secure | High-security apps |

### Configuring Storage Type

```typescript
// In TokenManager.ts - change default
const TokenManager = new TokenManagerClass({
  storageType: 'localStorage', // or 'sessionStorage' or 'memory'
});

// Or configure at runtime
TokenManager.setStorageType('sessionStorage');
```

### Session Expiry Handling

The access token typically expires after 1 hour (configurable on backend). The refresh token lasts much longer (default 100 days). This means:

- Users stay logged in for extended periods
- Access tokens are short-lived for security
- Refresh happens transparently in the background

---

## Advanced Patterns

### Pattern 1: Background Session Verification

Periodically verify the session is still valid:

```typescript
// src/hooks/useSessionCheck.ts

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { SKAFTIN_CONFIG } from '../config/skaftin.config';

export function useSessionCheck(intervalMs = SKAFTIN_CONFIG.sessionCheckInterval) {
  const { isAuthenticated, verifySession, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = async () => {
      const isValid = await verifySession();
      if (!isValid) {
        console.log('Session expired, logging out...');
      }
    };

    // Check immediately
    checkSession();

    // Then check periodically
    const interval = setInterval(checkSession, intervalMs);

    return () => clearInterval(interval);
  }, [isAuthenticated, verifySession, intervalMs]);
}
```

### Pattern 2: Optimistic Token Refresh

Refresh before expiry instead of waiting for 401:

```typescript
// src/hooks/useTokenRefresh.ts

import { useEffect } from 'react';
import { TokenManager } from '../services/TokenManager';
import { SkaftinClient } from '../services/SkaftinClient';
import { useAuthStore } from '../stores/authStore';
import { SKAFTIN_CONFIG } from '../config/skaftin.config';

export function useTokenRefresh() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkAndRefresh = async () => {
      // Check if token will expire soon
      if (TokenManager.isTokenExpired(SKAFTIN_CONFIG.tokenRefreshBuffer)) {
        console.log('Token expiring soon, refreshing...');
        
        try {
          const response = await SkaftinClient.post('/auth/session/refresh');
          if (response.data?.accessToken) {
            TokenManager.setAccessToken(response.data.accessToken);
            console.log('Token refreshed successfully');
          }
        } catch (error) {
          console.error('Proactive token refresh failed:', error);
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefresh, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);
}
```

### Pattern 3: Multi-Tab Synchronization

Keep auth state synced across browser tabs:

```typescript
// src/hooks/useAuthSync.ts

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { SKAFTIN_CONFIG } from '../config/skaftin.config';

export function useAuthSync() {
  const { logout, verifySession } = useAuthStore();

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Check if auth storage changed
      if (event.key === 'auth-storage') {
        if (event.newValue === null) {
          // Storage cleared (logout in another tab)
          logout();
        } else {
          // Auth state changed, re-verify
          verifySession();
        }
      }
      
      // Check if token directly changed
      if (event.key === SKAFTIN_CONFIG.tokenStorageKey) {
        if (event.newValue === null) {
          logout();
        } else {
          verifySession();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [logout, verifySession]);
}
```

### Pattern 4: Auth Service for Non-React Code

Use auth outside React components:

```typescript
// src/services/AuthService.ts

import { useAuthStore } from '../stores/authStore';
import { TokenManager } from './TokenManager';
import { SkaftinClient } from './SkaftinClient';

/**
 * Auth service for use outside React components
 * (e.g., in utility functions, API services, etc.)
 */
export const AuthService = {
  /**
   * Get current user
   */
  getUser() {
    return useAuthStore.getState().user;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return useAuthStore.getState().isAuthenticated;
  },

  /**
   * Get current access token
   */
  getToken() {
    return TokenManager.getAccessToken();
  },

  /**
   * Check if user has role
   */
  hasRole(roleKey: string) {
    return useAuthStore.getState().hasRole(roleKey);
  },

  /**
   * Logout programmatically
   */
  async logout() {
    return useAuthStore.getState().logout();
  },

  /**
   * Login programmatically
   */
  async login(email: string, password: string) {
    return useAuthStore.getState().login({ email, password });
  },
};

export default AuthService;
```

---

## Troubleshooting

### Common Issues

#### 1. "Token refresh keeps failing"

**Cause:** The refresh endpoint might require a different token or the session has fully expired.

**Solution:**
- Check if the refresh token exists and is valid
- Ensure the API key is included in refresh requests
- Check backend logs for specific errors

```typescript
// Debug token state
console.log('Token exists:', TokenManager.hasToken());
console.log('Token expired:', TokenManager.isTokenExpired());
console.log('Token expiry:', TokenManager.getTokenExpiry());
console.log('Token payload:', TokenManager.parseToken());
```

#### 2. "User gets logged out on page refresh"

**Cause:** Zustand persistence might not be set up correctly.

**Solution:**
- Ensure `persist` middleware is configured
- Check localStorage for `auth-storage` key
- Verify `verifySession()` is called in AuthProvider

```typescript
// Check storage
console.log('Stored auth:', localStorage.getItem('auth-storage'));
console.log('Stored token:', localStorage.getItem('skaftin_access_token'));
```

#### 3. "401 errors not triggering refresh"

**Cause:** Interceptor might not be properly configured.

**Solution:**
- Check if the interceptor is attached to the right axios instance
- Ensure auth endpoints are excluded from retry logic
- Verify the refresh endpoint URL is correct

#### 4. "CORS errors with auth requests"

**Cause:** Backend might not have proper CORS configuration.

**Solution:**
- Check backend CORS settings include your frontend origin
- Ensure credentials mode is set correctly
- Check if API key header is allowed

```typescript
// In SkaftinClient, ensure credentials are included
this.client = axios.create({
  baseURL: SKAFTIN_CONFIG.apiUrl,
  withCredentials: true, // If using cookies
});
```

#### 5. "User data not updating after login"

**Cause:** State might not be properly synced.

**Solution:**
```typescript
// Force re-verification after login
const success = await login({ email, password });
if (success) {
  await verifySession(); // Fetch fresh user data
}
```

### Debug Mode

Enable verbose logging for debugging:

```typescript
// Add to SkaftinClient.ts for debugging
this.client.interceptors.request.use((config) => {
  console.log('🚀 Request:', config.method?.toUpperCase(), config.url);
  console.log('   Headers:', config.headers);
  return config;
});

this.client.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.log('❌ Error:', error.response?.status, error.config?.url);
    console.log('   Message:', error.response?.data?.message);
    return Promise.reject(error);
  }
);
```

---

## Complete File Structure

```
src/
├── config/
│   └── skaftin.config.ts          # Configuration
├── services/
│   ├── TokenManager.ts            # Token storage management
│   ├── SkaftinClient.ts           # HTTP client with auto-refresh
│   └── AuthService.ts             # Auth utilities for non-React code
├── stores/
│   └── authStore.ts               # Zustand auth store
├── hooks/
│   ├── useAuth.ts                 # Simple auth hook
│   ├── useSessionCheck.ts         # Background session verification
│   ├── useTokenRefresh.ts         # Proactive token refresh
│   └── useAuthSync.ts             # Multi-tab synchronization
├── components/
│   ├── AuthProvider.tsx           # Auth context provider
│   └── ProtectedRoute.tsx         # Route protection component
└── pages/
    ├── LoginPage.tsx              # Login form
    └── RegisterPage.tsx           # Registration form
```

---

## Next Steps

1. **Copy the files** from this guide into your project
2. **Configure** your API URL and key in `skaftin.config.ts`
3. **Wrap your app** with `AuthProvider`
4. **Protect routes** with `ProtectedRoute`
5. **Test** login/logout and session persistence

For more advanced features, see:
- [07-APP-USER-AUTHENTICATION.md](./07-APP-USER-AUTHENTICATION.md) - Full API reference
- [08-WEBSOCKET-INTEGRATION.md](./08-WEBSOCKET-INTEGRATION.md) - Real-time updates
- [08-FORGOT-PASSWORD.md](./08-FORGOT-PASSWORD.md) - Password reset flow
