import { useState, useEffect, useCallback } from 'react';
import { api, Wallet } from '../services/api';

interface WalletsState {
  wallets: Wallet[];
  isLoading: boolean;
  error: string | null;
}

export function useWallets() {
  const [state, setState] = useState<WalletsState>({
    wallets: [],
    isLoading: false,
    error: null,
  });

  const fetchWallets = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const wallets = await api.get<Wallet[]>('/api/wallets');
      setState({ wallets, isLoading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch wallets',
      }));
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const totalBalanceUSD = state.wallets.reduce((sum, w) => {
    // In production this would use exchange rates
    // For now just sum wallets that are in USD
    if (w.currency === 'USD') return sum + w.balance;
    return sum;
  }, 0);

  return { ...state, fetchWallets, totalBalanceUSD };
}
