import { ArrowRight, BookOpen, CheckCircle2, Clock3, Users } from "lucide-react";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useStudentIdentity } from "../../../hooks/useStudentIdentity";
import type { ClassSummary, CreatedHold } from "../../../types/api";
import { useClassesQuery } from "../../classes/queries";
import { ReservationCountdown } from "../components/ReservationCountdown";
import { StudentIdentitySelector } from "../components/StudentIdentitySelector";
import { useCreateHoldMutation } from "../mutations";
import { useHoldQuery } from "../queries";
import { getErrorMessage } from "../../../components/ui/errorMessage";

interface StudentWorkflowState {
  studentId: string;
  createdHold?: CreatedHold;
  actionError?: string;
}

export function StudentClassesPage() {
  const { studentId } = useStudentIdentity();
  const classesQuery = useClassesQuery();
  const createHoldMutation = useCreateHoldMutation();
  const [workflowState, setWorkflowState] = useState<StudentWorkflowState>();
  const [searchTerm, setSearchTerm] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available">("all");
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setWorkflowState((current) => (current?.studentId === studentId ? current : undefined));
  }, [studentId]);

  const visibleWorkflowState = workflowState?.studentId === studentId ? workflowState : undefined;
  const filteredClasses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    return (classesQuery.data ?? []).filter((admissionClass) => {
      const matchesSearch =
        !normalizedSearch || admissionClass.name.toLocaleLowerCase().includes(normalizedSearch);
      const matchesAvailability = availabilityFilter === "all" || admissionClass.availableSeats > 0;
      return matchesSearch && matchesAvailability;
    });
  }, [availabilityFilter, classesQuery.data, searchTerm]);

  const applyForClass = useCallback(
    (classId: string) => {
      if (!studentId) {
        return;
      }

      const requestSequence = ++requestSequenceRef.current;
      const requestStudentId = studentId;
      setWorkflowState({ studentId: requestStudentId });
      createHoldMutation.mutate(
        { classId, studentId: requestStudentId },
        {
          onSuccess: (hold) => {
            if (requestSequenceRef.current !== requestSequence) {
              return;
            }

            setWorkflowState({ studentId: requestStudentId, createdHold: hold });
          },
          onError: (error) => {
            if (requestSequenceRef.current !== requestSequence) {
              return;
            }

            setWorkflowState({
              studentId: requestStudentId,
              actionError: getErrorMessage(error),
            });
          },
        },
      );
    },
    [createHoldMutation, studentId],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        description="Explore available classes, review seat availability and reserve your place through the admission portal."
        eyebrow="Student portal"
        title="Find the right class for your next step"
        actions={
          <Link
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            to="/student/applications"
          >
            View application history <span aria-hidden="true">→</span>
          </Link>
        }
      />
      <StudentIdentitySelector />
      {visibleWorkflowState?.actionError ? (
        <InlineNotice tone="error">{visibleWorkflowState.actionError}</InlineNotice>
      ) : null}
      {visibleWorkflowState?.createdHold ? (
        <CreatedHoldNotice hold={visibleWorkflowState.createdHold} />
      ) : null}
      <section aria-labelledby="available-classes-heading" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-slate-950"
              id="available-classes-heading"
            >
              Explore available classes
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Seat counts come directly from the API and may change before an application is
              submitted.
            </p>
          </div>
          <Badge tone="info">Live catalogue</Badge>
        </div>
        {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand-border/80 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex flex-1 items-center gap-3">
              <Search aria-hidden="true" className="ml-1 size-4 shrink-0 text-slate-400" />
              <Input
                aria-label="Search available classes"
                className="min-h-10 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                label="Search classes"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by class name"
                value={searchTerm}
              />
            </div>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-slate-600">
              <span className="sr-only">Filter classes</span>
              <span aria-hidden="true">Show</span>
              <select
                aria-label="Filter classes"
                className="bg-transparent font-bold text-slate-800 outline-none"
                onChange={(event) =>
                  setAvailabilityFilter(event.target.value as "all" | "available")
                }
                value={availabilityFilter}
              >
                <option value="all">All classes</option>
                <option value="available">With seats</option>
              </select>
            </label>
          </div>
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
          <p aria-live="polite" className="text-xs font-semibold text-slate-500">
            Showing {filteredClasses.length} of {classesQuery.data.length} published offering
            {classesQuery.data.length === 1 ? "" : "s"}
          </p>
        ) : null}
        {classesQuery.isPending ? <LoadingIndicator label="Loading classes" /> : null}
        {classesQuery.isError ? (
          <ErrorState error={classesQuery.error} onRetry={() => void classesQuery.refetch()} />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length === 0 ? (
          <EmptyState
            description="The administrator has not published any classes yet. Check back soon."
            icon={BookOpen}
            title="No classes published"
          />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length > 0 && filteredClasses.length === 0 ? (
          <EmptyState
            description="Try a different class name or switch the filter to see every published offering."
            icon={Search}
            title="No matching classes"
          />
        ) : null}
        {classesQuery.isSuccess && filteredClasses.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredClasses.map((admissionClass) => (
              <ClassCard
                admissionClass={admissionClass}
                isSubmitting={
                  createHoldMutation.isPending &&
                  createHoldMutation.variables?.classId === admissionClass.id
                }
                key={admissionClass.id}
                onApply={applyForClass}
                studentId={studentId}
                workflowBusy={createHoldMutation.isPending}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ClassCard({
  admissionClass,
  isSubmitting,
  onApply,
  studentId,
  workflowBusy,
}: {
  admissionClass: ClassSummary;
  isSubmitting: boolean;
  onApply: (classId: string) => void;
  studentId: string | null;
  workflowBusy: boolean;
}) {
  const noSeats = admissionClass.availableSeats <= 0;
  const availability = getAvailability(admissionClass.availableSeats);
  const disabled = noSeats || !studentId || workflowBusy;

  return (
    <Card className="group relative flex flex-col justify-between gap-5 overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_38px_rgba(16,42,67,0.1)] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full bg-indigo-50 opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100" />
      <div>
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-[10px] font-bold text-brand-indigo">Class offering</p>
            <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950">
              {admissionClass.name}
            </h3>
            <p className="mt-2 break-all text-xs text-slate-500">Class ID · {admissionClass.id}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-indigo-soft text-brand-indigo">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
            <span className={`text-right text-xs font-bold ${availability.textClass}`}>
              {availability.label}
            </span>
          </div>
        </div>

        <div
          className={`relative mt-6 flex items-end justify-between gap-4 rounded-2xl border p-4 ${noSeats ? "border-rose-100 bg-rose-50/70" : availability.textClass === "text-amber-700" ? "border-amber-100 bg-amber-50/70" : "border-indigo-100 bg-brand-indigo-soft/60"}`}
        >
          <div>
            <p className="text-sm font-semibold text-indigo-950">Seats available</p>
            <p className="mt-1 text-xs text-indigo-800/75">{availability.description}</p>
          </div>
          <p
            className={`text-4xl font-extrabold tracking-tight ${noSeats ? "text-rose-700" : availability.textClass === "text-amber-700" ? "text-amber-700" : "text-brand-indigo"}`}
          >
            {admissionClass.availableSeats}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-brand-border bg-slate-50/70 py-3 text-center">
          <SeatMetric label="Total" value={admissionClass.totalSeats} />
          <SeatMetric label="Held" value={admissionClass.heldSeats} />
          <SeatMetric label="Confirmed" value={admissionClass.confirmedSeats} />
        </dl>

        <SeatCapacityBar admissionClass={admissionClass} />
      </div>

      <div className="flex flex-col gap-3 border-t border-brand-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs leading-5 text-slate-600">
          {noSeats ? (
            <Users aria-hidden="true" className="size-4 shrink-0 text-rose-700" />
          ) : (
            <Clock3 aria-hidden="true" className="size-4 shrink-0 text-brand-indigo" />
          )}
          {noSeats
            ? "This class is currently full"
            : studentId
              ? "Reserve a seat temporarily"
              : "Select your identity to apply"}
        </p>
        <Button
          className="w-full sm:w-auto"
          disabled={disabled}
          isLoading={isSubmitting}
          title={
            noSeats
              ? "No seats are currently available"
              : !studentId
                ? "Select a birth registration number first"
                : undefined
          }
          variant={noSeats ? "secondary" : "primary"}
          onClick={() => onApply(admissionClass.id)}
        >
          {noSeats ? "No seats available" : "Apply for admission"}
          {!noSeats ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </Button>
      </div>
    </Card>
  );
}

function CreatedHoldNotice({ hold }: { hold: CreatedHold }) {
  const holdQuery = useHoldQuery(hold.holdId, false);
  const refetchHold = holdQuery.refetch;
  const refreshAuthoritativeHold = useCallback(() => {
    void refetchHold();
  }, [refetchHold]);
  const status = holdQuery.data?.status ?? hold.status;

  return (
    <Card
      aria-live="polite"
      className="border-emerald-200 bg-emerald-50/70 shadow-[0_10px_28px_rgba(4,120,87,0.08)]"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-emerald-950">Seat temporarily reserved</h2>
              <Badge tone="success">Application created</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Hold <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">{hold.holdId}</code>{" "}
              was created. Complete confirmation before the server-provided expiry time.
            </p>
            <Link
              className="mt-3 inline-flex text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
              to="/student/applications"
            >
              Open application history
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusBadge status={status} />
          {status === "HELD" ? (
            <>
              <ReservationCountdown
                expiresAt={hold.expiresAt}
                isChecking={holdQuery.isFetching}
                onReachedZero={refreshAuthoritativeHold}
              />
              <span className="text-xs text-slate-600">Expires {formatDate(hold.expiresAt)}</span>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? "date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SeatMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2">
      <dt className="text-lg font-bold text-slate-900">{value}</dt>
      <dd className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dd>
    </div>
  );
}

function SeatCapacityBar({ admissionClass }: { admissionClass: ClassSummary }) {
  const occupiedSeats = admissionClass.heldSeats + admissionClass.confirmedSeats;
  const capacity = Math.max(admissionClass.totalSeats, 1);
  const utilization = Math.min(100, Math.max(0, (occupiedSeats / capacity) * 100));

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Seat utilization</span>
        <span className="font-semibold text-slate-700">{Math.round(utilization)}% occupied</span>
      </div>
      <div
        aria-label={`${occupiedSeats} of ${admissionClass.totalSeats} seats occupied`}
        aria-valuemax={admissionClass.totalSeats}
        aria-valuemin={0}
        aria-valuenow={occupiedSeats}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-brand-indigo transition-[width] duration-300"
          style={{ width: `${utilization}%` }}
        />
      </div>
    </div>
  );
}

function getAvailability(availableSeats: number): {
  description: string;
  label: string;
  textClass: string;
} {
  if (availableSeats <= 0) {
    return {
      description: "No seats remain in this class.",
      label: "Fully occupied",
      textClass: "text-rose-700",
    };
  }

  if (availableSeats === 1) {
    return {
      description: "Only one seat remains.",
      label: "Limited availability",
      textClass: "text-amber-700",
    };
  }

  return {
    description: "Seats are currently available.",
    label: "Seats available",
    textClass: "text-emerald-700",
  };
}
