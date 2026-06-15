import * as SecureStore from 'expo-secure-store';
import { api, AuthResponse, User } from './api';

const TOKEN_KEY = 'cobo_token';
const USER_KEY = 'cobo_user';

export const authService = {
  async login(
    email: string,
    password: string,
    totpCode?: string
  ): Promise<AuthResponse> {
    const body: Record<string, string> = { email, password };
    if (totpCode) body.totpCode = totpCode;
    const response = await api.post<AuthResponse>('/api/auth/login', body);
    if (response.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
    }
    if (response.user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
    }
    return response;
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
    businessName?: string;
  }): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/auth/register', data);
  },

  async getMe(): Promise<User> {
    return api.get<User>('/api/auth/me');
  },

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async getCachedUser(): Promise<User | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      if (raw) return JSON.parse(raw) as User;
      return null;
    } catch {
      return null;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return !!token;
  },
};
