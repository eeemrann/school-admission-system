import type { HoldStatus } from "../../types/api";

interface BadgeProps {
  children: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${badgeTones[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: HoldStatus }) {
  const tone =
    status === "CONFIRMED"
      ? "success"
      : status === "HELD"
        ? "warning"
        : status === "EXPIRED"
          ? "danger"
          : "neutral";

  return <Badge tone={tone}>{status}</Badge>;
}

const badgeTones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200/80 bg-brand-success-soft text-brand-success",
  warning: "border-amber-200/80 bg-brand-warning-soft text-brand-warning",
  danger: "border-rose-200/80 bg-brand-danger-soft text-brand-danger",
  info: "border-indigo-100 bg-brand-indigo-soft text-brand-indigo",
};
