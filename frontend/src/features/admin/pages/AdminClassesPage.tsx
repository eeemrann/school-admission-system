import { useState } from "react";
import { CheckCircle2, Plus, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { getErrorMessage } from "../../../components/ui/errorMessage";
import { Input } from "../../../components/ui/Input";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "../../../lib/api/client";
import { classesQueryKey, useClassesQuery } from "../../classes/queries";

export function AdminClassesPage() {
  const classesQuery = useClassesQuery();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [formError, setFormError] = useState<string>();
  const createMutation = useMutation({
    mutationFn: () =>
      getApiClient().createClass({ name: name.trim(), totalSeats: Number(totalSeats) }),
    onSuccess: async () => {
      setName("");
      setTotalSeats("");
      setFormError(undefined);
      await queryClient.invalidateQueries({ queryKey: classesQueryKey });
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedSeats = Number(totalSeats);
    if (!name.trim() || !Number.isInteger(parsedSeats) || parsedSeats <= 0) {
      setFormError("Enter a class name and a positive whole-number seat count.");
      return;
    }

    setFormError(undefined);
    createMutation.mutate();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        description="Maintain class offerings through the existing class-management API."
        eyebrow="Administration"
        title="Class management"
      />
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-950">Create a class</h2>
            <p className="mt-1 text-sm text-slate-600">
              Capacity is validated by the API and becomes immutable through the current contract.
            </p>
          </div>
        </div>
        <form
          className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
          onSubmit={submitClass}
        >
          <Input
            label="Class name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Class 6 - Morning Shift"
            value={name}
          />
          <Input
            label="Total seats"
            min="1"
            onChange={(event) => setTotalSeats(event.target.value)}
            placeholder="120"
            type="number"
            value={totalSeats}
          />
          <Button isLoading={createMutation.isPending} type="submit">
            Create class
          </Button>
        </form>
        {formError ? (
          <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
            {formError}
          </p>
        ) : null}
        {createMutation.isSuccess ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="size-4" /> Class created.
          </p>
        ) : null}
      </Card>
      <section className="space-y-4" aria-labelledby="managed-classes-heading">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950" id="managed-classes-heading">
              Published classes
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The API remains the source of truth for every counter.
            </p>
          </div>
          <Badge tone="info">API-backed</Badge>
        </div>
        {classesQuery.isPending ? <LoadingIndicator label="Loading classes" /> : null}
        {classesQuery.isError ? (
          <ErrorState error={classesQuery.error} onRetry={() => void classesQuery.refetch()} />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length === 0 ? (
          <EmptyState
            description="Create the first class offering above."
            icon={Users}
            title="No classes yet"
          />
        ) : null}
        {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {classesQuery.data.map((admissionClass) => (
              <Card key={admissionClass.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-950">{admissionClass.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{admissionClass.id}</p>
                  </div>
                  <Badge
                    tone={admissionClass.availableSeats > 0 ? "success" : "danger"}
                  >{`${admissionClass.availableSeats} available`}</Badge>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                  <Metric label="Capacity" value={admissionClass.totalSeats} />
                  <Metric label="Held" value={admissionClass.heldSeats} />
                  <Metric label="Confirmed" value={admissionClass.confirmedSeats} />
                </dl>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="font-bold text-slate-900">{value}</dt>
      <dd className="mt-1 text-slate-500">{label}</dd>
    </div>
  );
}
