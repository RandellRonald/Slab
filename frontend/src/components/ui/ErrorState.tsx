export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
      <h2 className="font-semibold text-slab-error">{title}</h2>
      <p className="mt-1 text-slate-700">{message}</p>
    </div>
  );
}
