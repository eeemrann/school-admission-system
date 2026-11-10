import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";
import { LoadingIndicator } from "../../../components/ui/LoadingIndicator";
import { PageHeader } from "../../../components/ui/PageHeader";
import { AdminClassTable } from "../components/AdminClassTable";
import { CreateClassDialog } from "../components/CreateClassDialog";
import { useAdminClassesQuery } from "../queries";

export function AdminClassesPage() {
  const classesQuery = useAdminClassesQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);

  const filteredClasses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

    if (!normalizedSearch) {
      return classesQuery.data ?? [];
    }

    return (classesQuery.data ?? []).filter((admissionClass) =>
      admissionClass.name.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [classesQuery.data, searchTerm]);

  return (
    <div className="space-y-8">
      <PageHeader
        description="Create and review class offerings through the existing class-management API. Seat counters are never estimated in the browser."
        eyebrow="Administration"
        title="Class management"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New class
          </Button>
        }
      />
      {createdNotice ? (
        <InlineNotice tone="success">Class created and the class list was refreshed.</InlineNotice>
      ) : null}
      <section aria-labelledby="published-classes-heading" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-950" id="published-classes-heading">
                Published classes
              </h2>
              <Badge tone="info">API-backed</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Search by class name or open a row for its complete capacity view.
            </p>
          </div>
          {classesQuery.isSuccess && classesQuery.data.length > 0 ? (
            <div className="w-full sm:w-72">
              <Input
                aria-label="Search classes by name"
                label="Search classes"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name"
                value={searchTerm}
              />
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
          <AdminClassTable classes={filteredClasses} />
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
