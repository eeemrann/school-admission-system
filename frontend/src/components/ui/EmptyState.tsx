import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-border bg-white/80 px-6 py-10 text-center shadow-[0_8px_24px_rgba(16,42,67,0.03)]">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-indigo-soft text-brand-indigo">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
