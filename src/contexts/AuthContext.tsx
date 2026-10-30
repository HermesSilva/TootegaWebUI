import { createContext, useState, useCallback, useEffect, useRef, type ReactNode, type JSX } from 'react';
import type { AuthContextType, LoginRequest, LoginResponse, RefreshTokenRequest, User } from '@core/types';
import { api, setAccessToken, setRefreshTokenHandler, setSessionInvalidationHandler } from '@core/lib/api';
import { esquecerNovidadesMostradas } from '@core/lib/marcaDeNovidades';

const STORAGE_KEY = 'Tootega_auth';
const TOKEN_KEY = 'Tootega_tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

const initialState: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  setSession: () => {},
  logout: async () => {},
};

export const AuthContext = createContext<AuthContextType>(initialState);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTokens = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    // Fim da sessão: o próximo login mostra de novo as novidades da versão ainda não dispensadas.
    esquecerNovidadesMostradas();
    if (refreshTimeoutRef.current)
      clearTimeout(refreshTimeoutRef.current);
  }, []);

  // Handler for session invalidation - redirects to login with message
  const handleSessionInvalidation = useCallback((): void => {
    clearTokens();
    setUser(null);
    // Redirect to login with expired flag
    window.location.href = '/login?expired=true';
  }, [clearTokens]);

  const scheduleTokenRefresh = useCallback((expiresAt: string, refreshToken: string): void => {
    if (refreshTimeoutRef.current)
      clearTimeout(refreshTimeoutRef.current);

    const expiresTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const refreshIn = expiresTime - now - 60000; // Refresh 1 minute before expiry

    if (refreshIn > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await api.auth.refresh<LoginResponse, RefreshTokenRequest>({ refreshToken });
          setAccessToken(response.accessToken);
          
          const tokens: StoredTokens = {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            accessTokenExpiresAt: response.accessTokenExpiresAt,
            refreshTokenExpiresAt: response.refreshTokenExpiresAt,
          };
          localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));
          
          scheduleTokenRefresh(response.accessTokenExpiresAt, response.refreshToken);
        } catch {
          clearTokens();
          setUser(null);
        }
      }, refreshIn);
    }
  }, [clearTokens]);

  const refreshTokenHandler = useCallback(async (): Promise<boolean> => {
    const storedTokens = localStorage.getItem(TOKEN_KEY);
    if (!storedTokens)
      return false;

    try {
      const tokens = JSON.parse(storedTokens) as StoredTokens;
      const response = await api.auth.refresh<LoginResponse, RefreshTokenRequest>({ 
        refreshToken: tokens.refreshToken 
      });
      
      setAccessToken(response.accessToken);
      
      const newTokens: StoredTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        accessTokenExpiresAt: response.accessTokenExpiresAt,
        refreshTokenExpiresAt: response.refreshTokenExpiresAt,
      };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(newTokens));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));
      
      scheduleTokenRefresh(response.accessTokenExpiresAt, response.refreshToken);
      return true;
    } catch {
      clearTokens();
      setUser(null);
      return false;
    }
  }, [clearTokens, scheduleTokenRefresh]);

  useEffect(() => {
    setRefreshTokenHandler(refreshTokenHandler);
    setSessionInvalidationHandler(handleSessionInvalidation);
    
    const storedUser = localStorage.getItem(STORAGE_KEY);
    const storedTokens = localStorage.getItem(TOKEN_KEY);
    
    if (storedUser && storedTokens) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        const parsedTokens = JSON.parse(storedTokens) as StoredTokens;
        
        const refreshExpires = new Date(parsedTokens.refreshTokenExpiresAt).getTime();
        if (refreshExpires > Date.now()) {
          setUser(parsedUser);
          setAccessToken(parsedTokens.accessToken);
          scheduleTokenRefresh(parsedTokens.accessTokenExpiresAt, parsedTokens.refreshToken);
        } else {
          clearTokens();
        }
      } catch {
        clearTokens();
      }
    }
    
    setIsLoading(false);
    
    return () => {
      if (refreshTimeoutRef.current)
        clearTimeout(refreshTimeoutRef.current);
    };
  }, [clearTokens, refreshTokenHandler, scheduleTokenRefresh]);

  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    const response = await api.auth.login<LoginResponse, LoginRequest>(credentials);
    
    setAccessToken(response.accessToken);
    setUser(response.user);
    
    const tokens: StoredTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      refreshTokenExpiresAt: response.refreshTokenExpiresAt,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));
    
    scheduleTokenRefresh(response.accessTokenExpiresAt, response.refreshToken);
  }, [scheduleTokenRefresh]);

  // Establishes the session from an already-obtained login response (e.g. facial login),
  // mirroring login() — the credential was verified by the caller's endpoint.
  const setSession = useCallback((response: LoginResponse): void => {
    setAccessToken(response.accessToken);
    setUser(response.user);

    const tokens: StoredTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      refreshTokenExpiresAt: response.refreshTokenExpiresAt,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));

    scheduleTokenRefresh(response.accessTokenExpiresAt, response.refreshToken);
  }, [scheduleTokenRefresh]);

  const logout = useCallback(async (): Promise<void> => {
    const storedTokens = localStorage.getItem(TOKEN_KEY);
    
    if (storedTokens) {
      try {
        const tokens = JSON.parse(storedTokens) as StoredTokens;
        await api.auth.revoke<void, RefreshTokenRequest>({ refreshToken: tokens.refreshToken });
      } catch {
        // Continue with logout even if revoke fails
      }
    }
    
    clearTokens();
    setUser(null);
  }, [clearTokens]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    setSession,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
