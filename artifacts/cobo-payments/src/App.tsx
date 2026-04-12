import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import TransactionDetail from "@/pages/TransactionDetail";
import Merchants from "@/pages/Merchants";
import MerchantDetail from "@/pages/MerchantDetail";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
    if (!isLoading && isAuthenticated && location === "/login") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function IndexRedirect() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(isAuthenticated ? "/dashboard" : "/login");
  }, [isAuthenticated]);
  return null;
}

function Router() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Switch>
          <Route path="/" component={IndexRedirect} />
          <Route path="/login" component={Login} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/transactions/:id" component={TransactionDetail} />
          <Route path="/merchants" component={Merchants} />
          <Route path="/merchants/:id" component={MerchantDetail} />
          <Route path="/users" component={Users} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AuthGuard>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
