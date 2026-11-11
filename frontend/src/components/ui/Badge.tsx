import type { HoldStatus } from "../../types/api";

interface BadgeProps {
  children: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${badgeTones[tone]}`}
    >
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
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-brand-success-soft text-brand-success",
  warning: "bg-brand-warning-soft text-brand-warning",
  danger: "bg-brand-danger-soft text-brand-danger",
  info: "bg-brand-indigo-soft text-brand-indigo",
};
