import { Building2, HardHat, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

import type { AppRole } from "../../types/auth";

const roleLinks: Record<AppRole, { href: string; label: string; icon: typeof UserRound }[]> = {
  customer: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/customer/workspace", label: "Projects", icon: Building2 },
    { href: "/customer", label: "Customer", icon: UserRound }
  ],
  provider: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/provider", label: "Provider", icon: HardHat }
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin", label: "Admin", icon: ShieldCheck },
    { href: "/customer", label: "Customer View", icon: Building2 }
  ]
};

export function Sidebar({ role }: { role: AppRole }) {
  return (
    <aside className="slab-sidebar border-r border-slab-border bg-white p-4 lg:w-64">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {roleLinks[role].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${
                  isActive ? "bg-yellow-100 text-slab-ink" : "text-slab-muted hover:bg-slate-50 hover:text-slab-ink"
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
