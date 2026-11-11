import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Pencil, RefreshCw, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { CompactId } from "../../../components/ui/CompactId";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { ClassSummary } from "../../../types/api";
import { CapacityBar } from "../components/CapacityBar";
import { EditClassNameDialog } from "../components/EditClassNameDialog";
import { getClassUtilizationPercent } from "../metrics";
import { useAdminClassQuery } from "../queries";

export function AdminClassDetailsPage() {
  const { classId } = useParams();
  const classQuery = useAdminClassQuery(classId ?? "", Boolean(classId));
  const [editNameOpen, setEditNameOpen] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader
        description="Review authoritative seat counters and keep the human-facing offering name clear for students and families."
        eyebrow="Class details"
        title={classQuery.data?.name ?? "Class details"}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!classQuery.data}
              variant="primary"
              onClick={() => setEditNameOpen(true)}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit name
            </Button>
            <Button
              disabled={classQuery.isFetching}
              isLoading={classQuery.isFetching}
              variant="secondary"
              onClick={() => void classQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              to="/admin/classes"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              All classes
            </Link>
          </div>
        }
      />
      {!classId ? (
        <EmptyState
          description="Return to the class register and choose an offering to view its capacity details."
          icon={BookOpen}
          title="Class identifier missing"
        />
      ) : classQuery.isPending ? (
        <LoadingIndicator label="Loading class details" />
      ) : classQuery.isError ? (
        <ErrorState
          error={classQuery.error}
          onRetry={() => void classQuery.refetch()}
          title="We could not load this class"
        />
      ) : classQuery.isSuccess ? (
        <ClassDetails admissionClass={classQuery.data} />
      ) : null}
      {classQuery.data && classId ? (
        <EditClassNameDialog
          classId={classId}
          currentName={classQuery.data.name}
          currentTotalSeats={classQuery.data.totalSeats}
          onClose={() => setEditNameOpen(false)}
          onSaved={() => void classQuery.refetch()}
          open={editNameOpen}
        />
      ) : null}
    </div>
  );
}

function ClassDetails({ admissionClass }: { admissionClass: ClassSummary }) {
  const occupiedSeats = admissionClass.heldSeats + admissionClass.confirmedSeats;
  const utilization = getClassUtilizationPercent(admissionClass);

  return (
    <>
      <Card className="relative overflow-hidden border-indigo-100 bg-[radial-gradient(circle_at_90%_10%,rgba(165,180,252,0.55),transparent_34%),linear-gradient(135deg,#eef2ff,#f8fbff)]">
        <div className="pointer-events-none absolute -bottom-16 -right-8 size-48 rounded-full border-[28px] border-white/70" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-indigo-700 shadow-[0_8px_18px_rgba(79,70,229,0.12)]">
              <BookOpen aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="eyebrow text-[10px] font-bold text-indigo-700">Published offering</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {admissionClass.name}
              </h2>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wide">Class ID</span>
                <CompactId label="class ID" value={admissionClass.id} />
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 flex-col items-start gap-2 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:items-end">
            <Badge
              tone={
                admissionClass.availableSeats <= 0
                  ? "danger"
                  : admissionClass.availableSeats === 1
                    ? "warning"
                    : "success"
              }
            >
              {admissionClass.availableSeats <= 0
                ? "Fully occupied"
                : admissionClass.availableSeats === 1
                  ? "Limited availability"
                  : "Seats available"}
            </Badge>
            <p className="text-3xl font-bold tracking-tight text-brand-indigo">
              {admissionClass.availableSeats}
            </p>
            <p className="text-xs font-semibold text-slate-500">seats available</p>
          </div>
        </div>
        <div className="mt-8">
          <CapacityBar occupiedSeats={occupiedSeats} totalSeats={admissionClass.totalSeats} />
        </div>
      </Card>
      <section
        aria-label="Class capacity metrics"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <DetailMetric icon={Users} label="Total seats" value={admissionClass.totalSeats} />
        <DetailMetric icon={Clock3} label="Held seats" value={admissionClass.heldSeats} />
        <DetailMetric
          icon={CheckCircle2}
          label="Confirmed seats"
          value={admissionClass.confirmedSeats}
        />
        <DetailMetric
          emphasis
          icon={BookOpen}
          label="Available seats"
          value={admissionClass.availableSeats}
        />
      </section>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-950">Capacity utilization</h2>
            <p className="mt-1 text-sm text-slate-600">
              {occupiedSeats} of {admissionClass.totalSeats} seats are currently occupied.
            </p>
          </div>
          <span className="text-2xl font-bold text-indigo-700">{utilization}%</span>
        </div>
        <div className="mt-6">
          <CapacityBar occupiedSeats={occupiedSeats} totalSeats={admissionClass.totalSeats} />
        </div>
      </Card>
    </>
  );
}

function DetailMetric({
  emphasis = false,
  icon: Icon,
  label,
  value,
}: {
  emphasis?: boolean;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card
      className={`flex items-center gap-4 ${emphasis ? "border-indigo-100 bg-brand-indigo-soft/45" : ""}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-indigo shadow-sm">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      </div>
    </Card>
  );
}
