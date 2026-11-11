import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Plus, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { ClassSummary } from "../../../types/api";
import { AdminClassTable } from "../components/AdminClassTable";
import { CreateClassDialog } from "../components/CreateClassDialog";
import { deriveAdminMetrics } from "../metrics";
import { useAdminClassesQuery } from "../queries";

export function AdminClassesPage() {
  const classesQuery = useAdminClassesQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "full">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);

  const filteredClasses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

    return (classesQuery.data ?? []).filter((admissionClass) => {
      const matchesSearch =
        !normalizedSearch || admissionClass.name.toLocaleLowerCase().includes(normalizedSearch);
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && admissionClass.availableSeats > 0) ||
        (availabilityFilter === "full" && admissionClass.availableSeats <= 0);
      return matchesSearch && matchesAvailability;
    });
  }, [availabilityFilter, classesQuery.data, searchTerm]);

  return (
    <div className="space-y-8">
      <PageHeader
        description="Create class offerings, review live seat counters and open a detailed capacity view."
        eyebrow="Administration"
        title="Class management"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={classesQuery.isFetching}
              isLoading={classesQuery.isFetching}
              variant="secondary"
              onClick={() => void classesQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setCreatedNotice(false);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              New class
            </Button>
          </div>
        }
      />
      {classesQuery.isSuccess ? <ClassManagementSummary classes={classesQuery.data} /> : null}
      {createdNotice ? (
        <InlineNotice tone="success">Class created and the class list was refreshed.</InlineNotice>
      ) : null}
      <section aria-labelledby="published-classes-heading" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className="text-xl font-bold tracking-tight text-slate-950"
                id="published-classes-heading"
              >
                Published classes
              </h2>
              <Badge tone="info">API-backed</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Search by class name or open an offering for its complete capacity view.
            </p>
          </div>
          {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <Input
                aria-label="Search classes by name"
                className="min-w-64"
                label="Search classes"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name"
                value={searchTerm}
              />
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-slate-600">
                <span className="sr-only">Filter class availability</span>
                <span>Show</span>
                <select
                  aria-label="Filter class availability"
                  className="bg-transparent font-bold text-slate-800 outline-none"
                  onChange={(event) =>
                    setAvailabilityFilter(event.target.value as "all" | "available" | "full")
                  }
                  value={availabilityFilter}
                >
                  <option value="all">All</option>
                  <option value="available">With seats</option>
                  <option value="full">Full only</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
        {classesQuery.isPending ? <LoadingIndicator label="Loading classes" /> : null}
        {classesQuery.isError ? (
          <ErrorState error={classesQuery.error} onRetry={() => void classesQuery.refetch()} />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length === 0 ? (
          <EmptyState
            description="Create the first class offering to make it available to the student portal."
            icon={Users}
            title="No classes yet"
          />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length > 0 && filteredClasses.length === 0 ? (
          <EmptyState
            description="Try a different search term or clear the current filter."
            icon={Search}
            title="No matching classes"
          />
        ) : null}
        {classesQuery.isSuccess && filteredClasses.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-slate-500">
              Showing {filteredClasses.length} of {classesQuery.data.length} offerings
            </p>
            <AdminClassTable classes={filteredClasses} />
          </>
        ) : null}
      </section>
      <CreateClassDialog
        onClose={() => setDialogOpen(false)}
        onCreated={() => setCreatedNotice(true)}
        open={dialogOpen}
      />
    </div>
  );
}

function ClassManagementSummary({ classes }: { classes: readonly ClassSummary[] }) {
  const metrics = deriveAdminMetrics(classes);

  return (
    <section aria-label="Class register summary" className="grid gap-3 sm:grid-cols-3">
      <SummaryStat icon={BookOpenCheck} label="Published classes" value={metrics.totalClasses} />
      <SummaryStat icon={Users} label="Total capacity" value={metrics.totalCapacity} />
      <SummaryStat
        icon={CheckCircle2}
        label="Seats available"
        value={metrics.totalAvailableSeats}
        tone="success"
      />
    </section>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: typeof Users;
  label: string;
  tone?: "neutral" | "success";
  value: number;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${tone === "success" ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-700" : "border-brand-border bg-white text-brand-indigo"}`}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-white/80 shadow-sm">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div>
        <p className="text-xl font-extrabold tracking-tight">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}
