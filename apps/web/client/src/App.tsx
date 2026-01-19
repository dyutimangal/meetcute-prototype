import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { useEffect, useState } from "react";


function Router() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) {
          localStorage.removeItem("meetCuteUser");
          if (!cancelled) setIsAuthenticated(false);
          return;
        }
        const user = await response.json().catch(() => null);
        if (user?.username) {
          localStorage.setItem("meetCuteUser", JSON.stringify(user));
          if (!cancelled) setIsAuthenticated(true);
        } else if (!cancelled) {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground font-body">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route
        path={"/login"}
        component={() => {
          if (isAuthenticated) {
            setLocation("/user");
            return null;
          }
          return <Login />;
        }}
      />
      <Route
        path={"/register"}
        component={() => {
          if (isAuthenticated) {
            setLocation("/user");
            return null;
          }
          return <Register />;
        }}
      />
      <Route
        path={"/"}
        component={() => {
          if (isAuthenticated) {
            setLocation("/user");
            return null;
          }
          return <Register />;
        }}
      />
      <Route path={"/*"} component={() => {
        if (!isAuthenticated) {
          setLocation("/login");
          return null;
        }
        return (
          <Switch>
            <Route path={"/user"} component={Home} />
            <Route path={"/"} component={() => {
              setLocation("/user");
              return null;
            }} />
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        );
      }} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
