import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  phone: string | null;
  country: string | null;
  business_name: string | null;
  business_type: string | null;
  kyc_status: string;
  kyc_level: number;
  is_active: boolean;
}

interface Wallet {
  id: number;
  userId: number;
  currency: string;
  balance: number;
  lockedBalance: number;
  isDefault: boolean;
}

interface AuthContextType {
  user: User | null;
  wallets: Wallet[];
  loading: boolean;
  login: (email: string, password: string, totp_code?: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshWallets: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem("iapay_token");
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setWallets(data.wallets || []);
    } catch {
      localStorage.removeItem("iapay_token");
    }
    setLoading(false);
  };

  useEffect(() => { loadUser(); }, []);

  const login = async (email: string, password: string, totp_code?: string) => {
    const { data } = await api.post("/auth/login", { email, password, totp_code });
    if (data.requires_2fa) {
      const err: any = new Error("2FA required");
      err.response = { data };
      throw err;
    }
    localStorage.setItem("iapay_token", data.token);
    setUser(data.user);
    setWallets(data.wallets || []);
  };

  const register = async (formData: any) => {
    const { data } = await api.post("/auth/register", formData);
    localStorage.setItem("iapay_token", data.token);
    setUser(data.user);
    setWallets(data.wallets || []);
  };

  const logout = () => {
    localStorage.removeItem("iapay_token");
    setUser(null);
    setWallets([]);
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
    setWallets(data.wallets || []);
  };

  const refreshWallets = async () => {
    const { data } = await api.get("/wallets");
    setWallets(data.wallets || []);
  };

  return (
    <AuthContext.Provider value={{ user, wallets, loading, login, register, logout, refreshUser, refreshWallets }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
