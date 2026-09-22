export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slab-border bg-slate-50 p-5 text-sm">
      <h3 className="font-bold text-slab-ink">{title}</h3>
      <p className="mt-1 text-slab-muted">{message}</p>
    </div>
  );
}
