import { Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <section className="space-y-6">
      <Outlet />
    </section>
  );
}
