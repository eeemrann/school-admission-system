import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-sm font-medium text-slate-600 shadow-[0_8px_24px_rgba(16,42,67,0.04)]"
      role="status"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-full bg-brand-indigo-soft"
      >
        <LoaderCircle className="size-4 animate-spin text-indigo-700" />
      </span>
      <span>{label}</span>
    </div>
  );
}
