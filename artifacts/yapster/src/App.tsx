import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ChatLayout from "@/pages/chat";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuthStore } from "@/hooks/use-auth-store";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <RequireAuth>
      <Component />
    </RequireAuth>
  );
}

function RootRoute() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Redirect to="/chat" />;
  return <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/chat" component={() => <ProtectedRoute component={ChatLayout} />} />
      <Route path="/chat/:id" component={() => <ProtectedRoute component={ChatLayout} />} />
      
      <Route path="/profile/:userId" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      
      <Route component={NotFound} />
    </Switch>
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
