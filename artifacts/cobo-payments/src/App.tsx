import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LangProvider } from "./i18n/translations";
import { useEffect } from "react";
import "./index.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import SendMoney from "./pages/SendMoney";
import Deposit from "./pages/Deposit";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Exchange from "./pages/Exchange";
import PaymentLinks from "./pages/PaymentLinks";
import Beneficiaries from "./pages/Beneficiaries";
import Verification from "./pages/Verification";
import Notifications from "./pages/Notifications";
import Developer from "./pages/Developer";
import Merchants from "./pages/Merchants";
import MerchantDetail from "./pages/MerchantDetail";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Checkout from "./pages/Checkout";
import Receive from "./pages/Receive";
import IAPAY from "./pages/IAPAY";
import Landing from "./pages/Landing";
import Compliance from "./pages/Compliance";
import AmlPolicy from "./pages/AmlPolicy";
import NotFound from "./pages/not-found";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/terms", "/privacy", "/aml-policy", "/pay/"];

  useEffect(() => {
    if (!loading && !user && !publicPaths.some(p => p === "/" ? location === "/" : location.startsWith(p))) {
      setLocation("/login");
    }
    if (!loading && user && (location === "/login" || location === "/register")) {
      setLocation("/dashboard");
    }
  }, [user, loading, location]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 32, height: 32, marginBottom: 12 }} />
          <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Loading IAPAY...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function IndexRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (user) setLocation("/dashboard"); }, [user]);
  if (user) return null;
  return <Landing />;
}

function AppRouter() {
  return (
    <LangProvider>
      <AuthProvider>
        <AuthGuard>
          <Switch>
            <Route path="/" component={IndexRedirect} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/aml-policy" component={AmlPolicy} />
            <Route path="/pay/:sessionId" component={Checkout} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/wallets" component={Wallets} />
            <Route path="/iapay" component={IAPAY} />
            <Route path="/send" component={SendMoney} />
            <Route path="/receive" component={Receive} />
            <Route path="/deposit" component={Deposit} />
            <Route path="/transactions/:id" component={TransactionDetail} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/exchange" component={Exchange} />
            <Route path="/payment-links" component={PaymentLinks} />
            <Route path="/beneficiaries" component={Beneficiaries} />
            <Route path="/verification" component={Verification} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/developer" component={Developer} />
            <Route path="/merchants/:id" component={MerchantDetail} />
            <Route path="/merchants" component={Merchants} />
            <Route path="/reports" component={Reports} />
            <Route path="/admin" component={Admin} />
            <Route path="/compliance" component={Compliance} />
            <Route path="/settings" component={Settings} />
            <Route path="/activity-log" component={AuditLog} />
            <Route component={NotFound} />
          </Switch>
        </AuthGuard>
      </AuthProvider>
    </LangProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppRouter />
    </WouterRouter>
  );
}
