import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="relative flex flex-col gap-5 border-b border-brand-border/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="eyebrow mb-2 text-[11px] font-bold text-brand-indigo">{eyebrow}</p>
        ) : null}
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.06] tracking-[-0.035em] text-ink-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
