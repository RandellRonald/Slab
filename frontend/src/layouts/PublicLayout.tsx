import { Outlet } from "react-router-dom";

import { Header } from "../components/layout/Header";
import { SlabChatbot } from "../components/support/SlabChatbot";

export function PublicLayout() {
  return (
    <div className="slab-public-shell min-h-screen bg-slab-background">
      <Header />
      <main className="slab-page-main mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <SlabChatbot />
    </div>
  );
}
