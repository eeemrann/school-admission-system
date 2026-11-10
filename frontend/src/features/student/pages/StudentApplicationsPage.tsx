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
        description="Review applications associated with the selected birth registration number."
        eyebrow="Student portal"
        title="Application history"
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
      ) : null}
      {applicationsQuery.isPending ? (
        <LoadingIndicator label="Loading application history" />
      ) : null}
      {applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : null}
      {applicationsQuery.isSuccess && applicationsQuery.data.length === 0 ? (
        <EmptyState
          description="Applications created for this student will appear here, including expired and cancelled history."
          icon={ClipboardList}
          title="No applications yet"
        />
      ) : null}
      {applicationsQuery.isSuccess && applicationsQuery.data.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-950">Your applications</h2>
              <p className="mt-1 text-xs text-slate-500">
                Statuses and expiry are read from the API.
              </p>
            </div>
            <Badge tone="info">{`${applicationsQuery.data.length} total`}</Badge>
          </div>
          <div className="divide-y divide-slate-100">
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
    <article className="space-y-4 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{application.className}</h3>
            <StatusBadge status={status} />
          </div>
          <dl className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2 sm:gap-x-5">
            <div>
              <dt className="inline font-semibold text-slate-600">Application: </dt>
              <dd className="inline break-all">{application.holdId}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-600">Class ID: </dt>
              <dd className="inline break-all">{application.classId}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-600">Expires: </dt>
              <dd className="inline">{formatDate(application.expiresAt)}</dd>
            </div>
          </dl>
        </div>
        {isHeld ? (
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <ReservationCountdown
              expiresAt={application.expiresAt}
              isChecking={holdQuery.isFetching}
              onReachedZero={refreshAuthoritativeHold}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={countdownReachedZero || isActionPending}
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Confirm admission
              </Button>
              <Button
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
      </div>
      {actionMessage ? <InlineNotice tone="success">{actionMessage}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
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

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? "date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
