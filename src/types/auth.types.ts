export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  subscriptionStatus?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  /** Establishes the session from an already-obtained login response (e.g. facial login). */
  setSession: (response: LoginResponse) => void;
  logout: () => Promise<void>;
}
