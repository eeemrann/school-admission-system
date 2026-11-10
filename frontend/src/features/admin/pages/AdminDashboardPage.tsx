import { Activity, BookOpen, CheckCircle2, Clock3, Layers3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { ClassSummary } from "../../../types/api";
import { AdminClassTable } from "../components/AdminClassTable";
import { CapacityBar } from "../components/CapacityBar";
import { deriveAdminMetrics } from "../metrics";
import { useAdminClassesQuery } from "../queries";

export function AdminDashboardPage() {
  const classesQuery = useAdminClassesQuery();

  return (
    <div className="space-y-8">
      <PageHeader
        description="Monitor the class catalogue and seat capacity using live values returned by the admission API."
        eyebrow="Administration"
        title="Operations dashboard"
        actions={
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            to="/admin/classes"
          >
            Manage classes
          </Link>
        }
      />
      <Card className="border-amber-200 bg-amber-50/70">
        <div className="flex gap-3">
          <Activity aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-bold text-amber-950">
              Administrator authentication is not implemented
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              This assignment intentionally exposes the administrator UI without a login or
              authorization contract. Treat it as a local operations workflow, not a secure
              administrative system.
            </p>
          </div>
        </div>
      </Card>
      {classesQuery.isPending ? <LoadingIndicator label="Loading dashboard data" /> : null}
      {classesQuery.isError ? (
        <ErrorState error={classesQuery.error} onRetry={() => void classesQuery.refetch()} />
      ) : null}
      {classesQuery.isSuccess ? <DashboardContent classes={classesQuery.data} /> : null}
    </div>
  );
}

function DashboardContent({ classes }: { classes: readonly ClassSummary[] }) {
  const metrics = deriveAdminMetrics(classes);

  return (
    <>
      <section aria-labelledby="dashboard-metrics-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950" id="dashboard-metrics-heading">
              Capacity snapshot
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Derived from the current GET /classes response.
            </p>
          </div>
          <Badge tone="info">API-backed</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={Layers3} label="Classes" value={metrics.totalClasses} />
          <MetricCard icon={Users} label="Total capacity" value={metrics.totalCapacity} />
          <MetricCard icon={Clock3} label="Held seats" value={metrics.totalHeldSeats} />
          <MetricCard
            icon={CheckCircle2}
            label="Confirmed seats"
            value={metrics.totalConfirmedSeats}
          />
          <MetricCard icon={BookOpen} label="Available seats" value={metrics.totalAvailableSeats} />
          <MetricCard
            icon={Activity}
            label="Capacity utilized"
            value={`${metrics.utilizationPercent}%`}
          />
        </div>
      </section>

      <section
        aria-label="Capacity analysis"
        className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-950">Overall capacity</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Held and confirmed seats against total published capacity.
              </p>
            </div>
            <Badge tone={metrics.utilizationPercent >= 90 ? "warning" : "success"}>
              {`${metrics.utilizationPercent}% utilized`}
            </Badge>
          </div>
          <div className="mt-8">
            <CapacityBar occupiedSeats={metrics.occupiedSeats} totalSeats={metrics.totalCapacity} />
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
            <SummaryMetric label="Occupied" value={metrics.occupiedSeats} />
            <SummaryMetric label="Available" value={metrics.totalAvailableSeats} />
            <SummaryMetric label="Capacity" value={metrics.totalCapacity} />
          </dl>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-950">Class distribution</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Seat utilization by published class.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
              to="/admin/classes"
            >
              View all
            </Link>
          </div>
          {classes.length > 0 ? (
            <div className="mt-6 space-y-5">
              {classes.map((admissionClass) => (
                <div key={admissionClass.id}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate font-semibold text-slate-800">
                      {admissionClass.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {admissionClass.heldSeats + admissionClass.confirmedSeats}/
                      {admissionClass.totalSeats}
                    </span>
                  </div>
                  <CapacityBar
                    label={`${admissionClass.name} capacity`}
                    occupiedSeats={admissionClass.heldSeats + admissionClass.confirmedSeats}
                    totalSeats={admissionClass.totalSeats}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-600">No class distribution is available yet.</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="dashboard-classes-heading" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950" id="dashboard-classes-heading">
            Classes overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Authoritative counters from the class-management API.
          </p>
        </div>
        {classes.length > 0 ? (
          <AdminClassTable classes={classes} />
        ) : (
          <EmptyState
            description="Create a class offering to begin tracking capacity."
            icon={BookOpen}
            title="No classes published"
          />
        )}
      </section>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      </div>
    </Card>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="font-bold text-slate-900">{value}</dt>
      <dd className="mt-1 text-slate-500">{label}</dd>
    </div>
  );
}
