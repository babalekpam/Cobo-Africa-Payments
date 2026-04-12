import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import "./index.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import SendMoney from "./pages/SendMoney";
import Transactions from "./pages/Transactions";
import Exchange from "./pages/Exchange";
import PaymentLinks from "./pages/PaymentLinks";
import Beneficiaries from "./pages/Beneficiaries";
import Verification from "./pages/Verification";
import Notifications from "./pages/Notifications";
import Developer from "./pages/Developer";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import NotFound from "./pages/not-found";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
    if (!loading && user && (location === "/login" || location === "/register")) {
      setLocation("/dashboard");
    }
  }, [user, loading, location]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 32, height: 32, marginBottom: 12 }} />
          <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Loading COBO...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function IndexRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(user ? "/dashboard" : "/login"); }, [user]);
  return null;
}

function AppRouter() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Switch>
          <Route path="/" component={IndexRedirect} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/wallets" component={Wallets} />
          <Route path="/send" component={SendMoney} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/exchange" component={Exchange} />
          <Route path="/payment-links" component={PaymentLinks} />
          <Route path="/beneficiaries" component={Beneficiaries} />
          <Route path="/verification" component={Verification} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/developer" component={Developer} />
          <Route path="/admin" component={Admin} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AuthGuard>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppRouter />
    </WouterRouter>
  );
}
