import { ClipboardList, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge, StatusBadge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ConfirmationDialog } from "../../../components/ui/Dialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { getErrorMessage } from "../../../components/ui/errorMessage";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useStudentIdentity } from "../../../hooks/useStudentIdentity";
import type { ApplicationHistoryItem, HoldStatus } from "../../../types/api";
import { ReservationCountdown } from "../components/ReservationCountdown";
import { StudentIdentitySelector } from "../components/StudentIdentitySelector";
import { useCancelHoldMutation, useConfirmHoldMutation } from "../mutations";
import { useHoldQuery, useStudentApplicationsQuery } from "../queries";

export function StudentApplicationsPage() {
  const { studentId } = useStudentIdentity();
  const applicationsQuery = useStudentApplicationsQuery(studentId);

  return (
    <div className="space-y-8">
      <PageHeader
        description="Track your reservations, review application progress and manage your admission status."
        eyebrow="Student portal"
        title="Your admission applications"
        actions={
          <Button
            disabled={!studentId || applicationsQuery.isFetching}
            isLoading={applicationsQuery.isFetching}
            variant="secondary"
            onClick={() => void applicationsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        }
      />
      <StudentIdentitySelector />
      {!studentId ? (
        <EmptyState
          description="Enter a birth registration number above to load application history from the API."
          icon={ClipboardList}
          title="Select a birth registration number"
        />
      ) : applicationsQuery.isPending ? (
        <LoadingIndicator label="Loading application history" />
      ) : applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : applicationsQuery.isSuccess && applicationsQuery.data.length === 0 ? (
        <EmptyState
          description="Applications created for this student will appear here, including expired and cancelled history."
          icon={ClipboardList}
          title="No applications yet"
        />
      ) : applicationsQuery.isSuccess ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-brand-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Application timeline</h2>
              <p className="mt-1 text-xs text-slate-500">
                Statuses and reservation windows are read from the API.
              </p>
            </div>
            <Badge tone="info">{`${applicationsQuery.data.length} total`}</Badge>
          </div>
          <div className="grid gap-4">
            {applicationsQuery.data.map((application) => (
              <ApplicationRow
                application={application}
                key={application.holdId}
                studentId={studentId ?? ""}
              />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ApplicationRow({
  application,
  studentId,
}: {
  application: ApplicationHistoryItem;
  studentId: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [countdownReachedZero, setCountdownReachedZero] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const holdQuery = useHoldQuery(application.holdId, false);
  const confirmMutation = useConfirmHoldMutation();
  const cancelMutation = useCancelHoldMutation();
  const refetchHold = holdQuery.refetch;
  const serverStatus = holdQuery.data?.status;
  const mutationStatus = confirmMutation.data?.status;
  const status: HoldStatus =
    mutationStatus === "CONFIRMED" ? mutationStatus : (serverStatus ?? application.status);
  const isHeld = status === "HELD";
  const isActionPending = confirmMutation.isPending || cancelMutation.isPending;

  const refreshAuthoritativeHold = useCallback(() => {
    setCountdownReachedZero(true);
    void refetchHold();
  }, [refetchHold]);

  const confirm = useCallback(() => {
    setActionError(undefined);
    confirmMutation.mutate(
      { holdId: application.holdId, studentId },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setActionMessage("Admission confirmed. Your application history is updating.");
          setCountdownReachedZero(false);
        },
        onError: (error) => {
          setConfirmOpen(false);
          setActionError(getErrorMessage(error));
        },
      },
    );
  }, [application.holdId, confirmMutation, studentId]);

  const cancel = useCallback(() => {
    setActionError(undefined);
    cancelMutation.mutate(
      { holdId: application.holdId, studentId },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setActionMessage("Reservation cancelled. The application remains in your history.");
          setCountdownReachedZero(false);
        },
        onError: (error) => {
          setCancelOpen(false);
          setActionError(getErrorMessage(error));
        },
      },
    );
  }, [application.holdId, cancelMutation, studentId]);

  return (
    <article
      aria-label={`${status} application for ${application.className}`}
      className="rounded-2xl border border-brand-border bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-950">{application.className}</h3>
            <span aria-label={getStatusDescription(status)}>
              <StatusBadge status={status} />
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {getStatusDescription(status)}
          </p>
        </div>
        {isHeld ? (
          <div className="flex shrink-0 flex-col items-start gap-2 rounded-xl border border-indigo-100 bg-brand-indigo-soft/50 p-3 lg:items-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
              Reservation time remaining
            </p>
            <ReservationCountdown
              expiresAt={application.expiresAt}
              isChecking={holdQuery.isFetching}
              onReachedZero={refreshAuthoritativeHold}
            />
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-3 border-t border-brand-border pt-4 sm:grid-cols-3">
        <ApplicationDetail label="Application ID" value={application.holdId} />
        <ApplicationDetail label="Class ID" value={application.classId} />
        <ApplicationDetail
          label={status === "HELD" ? "Expires" : "Reservation window"}
          value={formatDate(application.expiresAt)}
        />
      </dl>

      {isHeld ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Ready to complete this application?
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Confirm before the server-provided expiry time, or cancel to release the reservation.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              disabled={countdownReachedZero || isActionPending}
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Confirm admission
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={countdownReachedZero || isActionPending}
              size="sm"
              variant="secondary"
              onClick={() => setCancelOpen(true)}
            >
              Cancel reservation
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {actionMessage ? <InlineNotice tone="success">{actionMessage}</InlineNotice> : null}
        {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      </div>
      <ConfirmationDialog
        confirmLabel="Confirm admission"
        description="This records the simulated admission-fee confirmation for this reservation. No payment provider or financial transaction is involved."
        isLoading={confirmMutation.isPending}
        open={confirmOpen}
        title="Confirm admission?"
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirm}
      />
      <ConfirmationDialog
        confirmLabel="Cancel reservation"
        confirmVariant="danger"
        description="Cancel this pending reservation? The application will stay in your history as CANCELLED and its held seat will be released by the backend."
        isLoading={cancelMutation.isPending}
        open={cancelOpen}
        title="Cancel reservation?"
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
      />
    </article>
  );
}

function ApplicationDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function getStatusDescription(status: HoldStatus): string {
  switch (status) {
    case "HELD":
      return "Temporary seat reservation is active.";
    case "CONFIRMED":
      return "Admission has been confirmed for this application.";
    case "EXPIRED":
      return "The reservation period ended before confirmation.";
    case "CANCELLED":
      return "This application was cancelled and its reservation was released.";
  }
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? "date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
