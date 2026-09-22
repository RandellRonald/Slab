import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../components/ui/LoadingState";
import { useAuth } from "../features/auth/AuthProvider";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Restoring your SLAB session" />;
  }

  if (!user) {
    const signInRoute = getSignInRoute(location.pathname);
    return <Navigate to={signInRoute} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function getSignInRoute(pathname: string) {
  if (pathname.startsWith("/admin")) return "/admin/login";
  if (pathname.startsWith("/provider")) return "/provider/login";
  if (pathname.startsWith("/booking") || pathname.startsWith("/customer")) return "/customer/login";
  return "/login";
}
