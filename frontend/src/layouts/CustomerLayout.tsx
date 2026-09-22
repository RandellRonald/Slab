import { Outlet } from "react-router-dom";

export function CustomerLayout() {
  return (
    <section className="space-y-6">
      <Outlet />
    </section>
  );
}
