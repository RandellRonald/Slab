import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "slab-button--primary bg-slab-primary text-slab-ink hover:bg-slab-primaryHover",
  secondary: "slab-button--secondary border border-slab-border bg-white text-slab-ink hover:bg-slate-50",
  ghost: "slab-button--ghost text-slab-muted hover:bg-slate-100"
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`slab-button inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
