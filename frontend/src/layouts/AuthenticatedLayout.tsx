import { Outlet } from "react-router-dom";

import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { useAuth } from "../features/auth/AuthProvider";

export function AuthenticatedLayout() {
  const { user } = useAuth();

  return (
    <div className="slab-auth-shell min-h-screen bg-slab-background">
      <Header />
      <div className="slab-auth-frame mx-auto flex max-w-7xl flex-col lg:min-h-[calc(100vh-4rem)] lg:flex-row">
        {user ? <Sidebar role={user.role} /> : null}
        <main className="slab-page-main flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
