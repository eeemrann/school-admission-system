import { ArrowUpRight, BookOpen, CheckCircle2, Clock3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { ClassSummary } from "../../../types/api";
import { getClassUtilizationPercent } from "../metrics";
import { CapacityBar } from "./CapacityBar";

export function AdminClassTable({ classes }: { classes: readonly ClassSummary[] }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-1 border-b border-brand-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">Class capacity register</h3>
          <p className="mt-1 text-sm text-slate-600">
            Review live capacity counters and open a read-only detail view.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">{classes.length} offerings</span>
      </div>
      <div aria-label="Class capacity overview" className="grid gap-3" role="list">
        {classes.map((admissionClass) => (
          <ClassRegisterCard admissionClass={admissionClass} key={admissionClass.id} />
        ))}
      </div>
    </Card>
  );
}

function ClassRegisterCard({ admissionClass }: { admissionClass: ClassSummary }) {
  const occupiedSeats = admissionClass.heldSeats + admissionClass.confirmedSeats;
  const utilization = getClassUtilizationPercent(admissionClass);
  const isFull = admissionClass.availableSeats <= 0;

  return (
    <article
      className="rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/20 sm:p-5"
      role="listitem"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-indigo-soft text-brand-indigo">
            <BookOpen aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h4 className="break-words font-bold text-slate-950">{admissionClass.name}</h4>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{admissionClass.id}</p>
          </div>
        </div>
        <Badge
          tone={isFull ? "danger" : admissionClass.availableSeats === 1 ? "warning" : "success"}
        >
          {isFull
            ? "Full"
            : admissionClass.availableSeats === 1
              ? "Limited availability"
              : `${admissionClass.availableSeats} available`}
        </Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SeatMetric icon={Users} label="Capacity" value={admissionClass.totalSeats} />
        <SeatMetric icon={Clock3} label="Held" value={admissionClass.heldSeats} />
        <SeatMetric icon={CheckCircle2} label="Confirmed" value={admissionClass.confirmedSeats} />
        <SeatMetric emphasis icon={Users} label="Available" value={admissionClass.availableSeats} />
      </dl>

      <div className="mt-5 grid gap-4 border-t border-brand-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <CapacityBar
          label="Seat utilization"
          occupiedSeats={occupiedSeats}
          totalSeats={admissionClass.totalSeats}
        />
        <span className="text-xs font-semibold text-slate-500">{utilization}% occupied</span>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          aria-label={`View details for ${admissionClass.name}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-brand-indigo hover:bg-brand-indigo-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-indigo"
          to={`/admin/classes/${admissionClass.id}`}
        >
          View details
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function SeatMetric({
  emphasis = false,
  icon: Icon,
  label,
  value,
}: {
  emphasis?: boolean;
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className={`rounded-xl p-3 ${emphasis ? "bg-brand-indigo-soft" : "bg-slate-50"}`}>
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={`size-4 ${emphasis ? "text-brand-indigo" : "text-slate-500"}`}
        />
        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      </div>
      <dd className={`mt-2 text-xl font-bold ${emphasis ? "text-brand-indigo" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}
