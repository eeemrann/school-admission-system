import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-brand-border bg-white p-8 text-sm font-medium text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-indigo-700" />
      <span>{label}</span>
    </div>
  );
}
