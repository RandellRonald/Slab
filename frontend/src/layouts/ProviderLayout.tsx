import { Outlet } from "react-router-dom";

export function ProviderLayout() {
  return (
    <section className="space-y-6">
      <Outlet />
    </section>
  );
}
