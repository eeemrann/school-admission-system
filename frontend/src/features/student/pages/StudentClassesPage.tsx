import { ArrowRight, BookOpen, Clock3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useClassesQuery } from "../../classes/queries";
import { StudentIdentitySelector } from "../components/StudentIdentitySelector";

export function StudentClassesPage() {
  const classesQuery = useClassesQuery();

  return (
    <div className="space-y-8">
      <PageHeader
        description="Browse the current class catalogue and see live seat availability from the API."
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
      <section aria-labelledby="available-classes-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950" id="available-classes-heading">
              Available classes
            </h2>
            <p className="mt-1 text-sm text-slate-600">Seat counts are authoritative API values.</p>
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
              <Card className="flex flex-col justify-between gap-6" key={admissionClass.id}>
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                        Class offering
                      </p>
                      <h3 className="mt-2 text-xl font-bold text-slate-950">
                        {admissionClass.name}
                      </h3>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                      <BookOpen aria-hidden="true" className="size-5" />
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                    <SeatMetric
                      label="Available"
                      value={admissionClass.availableSeats}
                      tone="success"
                    />
                    <SeatMetric label="On hold" value={admissionClass.heldSeats} />
                    <SeatMetric label="Confirmed" value={admissionClass.confirmedSeats} />
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Users aria-hidden="true" className="size-4" /> {admissionClass.totalSeats}{" "}
                    total seats
                  </p>
                  <Button
                    disabled
                    title="Seat reservation workflow will be connected in a later phase"
                    variant="secondary"
                  >
                    Reserve seat <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
      <Card className="flex gap-3 border-amber-200 bg-amber-50/60">
        <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <p className="text-sm leading-6 text-amber-900">
          Reservation, confirmation, cancellation, and expiry status refresh are intentionally
          reserved for the next frontend phase.
        </p>
      </Card>
    </div>
  );
}

function SeatMetric({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p
        className={`text-2xl font-bold ${tone === "success" ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-slate-500">{label}</p>
    </div>
  );
}
