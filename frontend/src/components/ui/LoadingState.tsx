export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-slab-muted">
      <div className="h-2 w-2 animate-pulse rounded-full bg-slab-primary" aria-hidden="true" />
      <span className="ml-3">{label}</span>
    </div>
  );
}
