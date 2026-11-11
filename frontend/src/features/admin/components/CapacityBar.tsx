import { getUtilizationPercent } from "../metrics";

interface CapacityBarProps {
  occupiedSeats: number;
  totalSeats: number;
  label?: string;
}

export function CapacityBar({
  occupiedSeats,
  totalSeats,
  label = "Capacity utilization",
}: CapacityBarProps) {
  const percent = getUtilizationPercent(occupiedSeats, totalSeats);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label={`${label}: ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200/80"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
