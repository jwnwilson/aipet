import { currentApiConfig } from './config';

// API Client for aipet_be backend
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  status: number;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface SignupResponse {
  message: string;
  user_id: number;
  verification_required: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  username: string;
}

// Scene data interfaces matching the backend
export type ObjectTypes = "pet" | "food" | "toy" | "bed" | "toilet" | "other";
export type Actions = "feed" | "play" | "toilet" | "sleep";

export interface SceneObject {
  type: ObjectTypes;
  position: [number, number, number];
}

export interface PetData extends SceneObject {
  type: ObjectTypes;
  hungry: number;
  tiredness: number;
  boredom: number;
  toilet: number;
}

export interface SceneData {
  scene_data: SceneObject[];
  pet_data: PetData;
}

export interface PetActionRecommendation {
  movement: [number, number, number] | null;
  action: Actions | null;
  reasoning: string;
}

export interface VerificationRequest {
  email: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private csrfToken: string | null = null;
  private isAuthDisabled: boolean;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || currentApiConfig.BASE_URL;
    this.isAuthDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';
    
    if (!this.isAuthDisabled) {
      this.csrfToken = localStorage.getItem('csrf_token');
      this.token = localStorage.getItem('access_token');
    }
  }

  // Method to fetch CSRF token from the API
  private async fetchCsrfToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/csrf/token`, {
        method: 'GET',
        credentials: 'include', // Include cookies for session-based CSRF
      });

      if (response.ok) {
        const data = await response.json();
        return data.csrf_token;
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token && !this.isAuthDisabled) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    // Add CSRF token if available and auth is not disabled
    if (!this.csrfToken) {
      this.csrfToken = await this.fetchCsrfToken();
    }
    if (this.csrfToken) {
      headers['X-CSRFToken'] = this.csrfToken;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session-based CSRF
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.message || data.detail || 'An error occurred',
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  // Authentication methods
  async signup(request: SignupRequest): Promise<ApiResponse<SignupResponse>> {
    return this.request<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async login(request: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/token/pair', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.data && !this.isAuthDisabled) {
      this.token = response.data.access;
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      
      // Fetch and store CSRF token after successful login
      const csrfToken = await this.fetchCsrfToken();
      if (csrfToken) {
        this.csrfToken = csrfToken;
        localStorage.setItem('csrf_token', csrfToken);
      }
    }

    return response;
  }

  async logout(): Promise<void> {
    if (!this.isAuthDisabled) {
      this.token = null;
      this.csrfToken = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('csrf_token');
    }
  }

  async verifyEmail(token: string): Promise<ApiResponse<{ message: string; verified: boolean }>> {
    return this.request<{ message: string; verified: boolean }>(`/auth/verify/${token}`, {
      method: 'GET',
    });
  }

  async resendVerification(request: VerificationRequest): Promise<ApiResponse<SignupResponse>> {
    return this.request<SignupResponse>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async requestPasswordReset(request: PasswordResetRequest): Promise<ApiResponse<{ message: string; success: boolean }>> {
    return this.request<{ message: string; success: boolean }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<ApiResponse<{ message: string; success: boolean }>> {
    return this.request<{ message: string; success: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // AI Pet methods
  async getPetRecommendations(
    sceneData: SceneData,
    model?: string
  ): Promise<ApiResponse<PetActionRecommendation>> {
    const params = model ? `?model=${encodeURIComponent(model)}` : '';
    return this.request<PetActionRecommendation>(`/aipet/recommendations${params}`, {
      method: 'POST',
      body: JSON.stringify(sceneData),
    });
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.isAuthDisabled || !!this.token;
  }

  // Refresh token method (if needed)
  async refreshToken(): Promise<ApiResponse<{ access: string; refresh: string }>> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return {
        error: 'No refresh token available',
        status: 401,
      };
    }

    const response = await this.request<{ access: string; refresh: string }>('/token/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.data) {
      this.token = response.data.access;
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
    }

    return response;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or custom instances
export default ApiClient; 