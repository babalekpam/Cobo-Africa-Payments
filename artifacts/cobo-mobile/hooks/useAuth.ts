import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { User } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        const user = await authService.getMe().catch(async () => {
          return await authService.getCachedUser();
        });
        setState({ user, isAuthenticated: !!user, isLoading: false, error: null });
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
      }
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  return { ...state, checkAuth, logout };
}
