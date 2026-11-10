import { ArrowRight, BookOpen, CheckCircle2, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { InlineNotice } from "../../../components/ui/InlineNotice";
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
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setWorkflowState((current) => (current?.studentId === studentId ? current : undefined));
  }, [studentId]);

  const visibleWorkflowState = workflowState?.studentId === studentId ? workflowState : undefined;

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
        description="Browse the current class catalogue, then submit an application for a temporary seat reservation."
        eyebrow="Student portal"
        title="Find your next class"
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
      <section aria-labelledby="available-classes-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950" id="available-classes-heading">
              Available classes
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Seat counts are authoritative API values; availability can change between viewing and
              applying.
            </p>
          </div>
          <Badge tone="info">Live catalogue</Badge>
        </div>
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
        {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {classesQuery.data.map((admissionClass) => (
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
  const disabled = noSeats || !studentId || workflowBusy;

  return (
    <Card className="flex flex-col justify-between gap-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
              Class offering
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{admissionClass.name}</h3>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
            <BookOpen aria-hidden="true" className="size-5" />
          </span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          <SeatMetric label="Total" value={admissionClass.totalSeats} />
          <SeatMetric label="Held" value={admissionClass.heldSeats} />
          <SeatMetric label="Confirmed" value={admissionClass.confirmedSeats} />
          <SeatMetric label="Available" tone="success" value={admissionClass.availableSeats} />
        </dl>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Users aria-hidden="true" className="size-4" />
          {noSeats ? "Currently full" : "Apply for a temporary reservation"}
        </p>
        <Button
          disabled={disabled}
          isLoading={isSubmitting}
          title={
            noSeats
              ? "No seats are currently available"
              : !studentId
                ? "Select a student ID first"
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
    <Card className="border-emerald-200 bg-emerald-50/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <h2 className="font-bold text-emerald-950">Seat temporarily reserved</h2>
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

function SeatMetric({ label, tone, value }: { label: string; tone?: "success"; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt
        className={`text-xl font-bold ${tone === "success" ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value}
      </dt>
      <dd className="mt-1 text-slate-500">{label}</dd>
    </div>
  );
}
