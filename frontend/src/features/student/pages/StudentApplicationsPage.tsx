import { ClipboardList } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useStudentIdentity } from "../../../hooks/useStudentIdentity";
import { useStudentApplicationsQuery } from "../queries";
import { StudentIdentitySelector } from "../components/StudentIdentitySelector";
import { StatusBadge } from "../../../components/ui/Badge";

export function StudentApplicationsPage() {
  const { studentId } = useStudentIdentity();
  const applicationsQuery = useStudentApplicationsQuery(studentId);

  return (
    <div className="space-y-8">
      <PageHeader
        description="Review applications associated with the selected assignment-level student ID."
        eyebrow="Student portal"
        title="Application history"
      />
      <StudentIdentitySelector />
      {!studentId ? (
        <EmptyState
          description="Enter a student ID above to load application history from the API."
          icon={ClipboardList}
          title="Select a student ID"
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
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="font-bold text-slate-950">Your applications</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {applicationsQuery.data.map((application) => (
              <article
                className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                key={application.holdId}
              >
                <div>
                  <h3 className="font-semibold text-slate-950">{application.className}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Application {application.holdId} · Expires {formatDate(application.expiresAt)}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </article>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? "date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
