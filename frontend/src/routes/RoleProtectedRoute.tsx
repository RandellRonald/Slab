import { Navigate, Outlet } from "react-router-dom";

import type { AppRole } from "../types/auth";
import { useAuth } from "../features/auth/AuthProvider";

export function RoleProtectedRoute({ roles }: { roles: AppRole[] }) {
  const { role } = useAuth();

  if (!role || !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
