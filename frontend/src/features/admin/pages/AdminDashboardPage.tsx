import { ArrowRight, LockKeyhole, Settings2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";

export function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        description="A focused workspace for maintaining class offerings and reviewing operational readiness."
        eyebrow="Administration"
        title="Administrator workspace"
      />
      <Card className="border-amber-200 bg-amber-50/70">
        <div className="flex gap-3">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-bold text-amber-950">
              Administrator authentication is not implemented
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              This take-home assignment intentionally exposes the admin surface without a login
              contract. Treat this area as a local development workflow, not a secure administrative
              system.
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="group" to="/admin/classes">
          <Card className="h-full transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <Settings2 aria-hidden="true" className="size-5" />
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-700"
              />
            </div>
            <h2 className="mt-6 text-lg font-bold text-slate-950">Class management</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create class offerings and inspect authoritative seat counters from the API.
            </p>
          </Card>
        </Link>
        <Card className="h-full bg-slate-50">
          <span className="grid size-11 place-items-center rounded-xl bg-slate-200 text-slate-600">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-6 text-lg font-bold text-slate-950">
            Live metrics are intentionally absent
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This foundation does not invent admission statistics. Future reporting should be backed
            by explicit API contract additions.
          </p>
        </Card>
      </div>
    </div>
  );
}
