import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { ClassSummary } from "../../../types/api";
import { getClassUtilizationPercent } from "../metrics";
import { CapacityBar } from "./CapacityBar";

export function AdminClassTable({ classes }: { classes: readonly ClassSummary[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <caption className="sr-only">Class capacity overview</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-6 py-4 font-bold" scope="col">
                Class
              </th>
              <th className="px-4 py-4 font-bold" scope="col">
                Capacity
              </th>
              <th className="px-4 py-4 font-bold" scope="col">
                Held
              </th>
              <th className="px-4 py-4 font-bold" scope="col">
                Confirmed
              </th>
              <th className="px-4 py-4 font-bold" scope="col">
                Available
              </th>
              <th className="px-4 py-4 font-bold" scope="col">
                Utilization
              </th>
              <th className="px-6 py-4 text-right font-bold" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.map((admissionClass) => {
              const utilization = getClassUtilizationPercent(admissionClass);

              return (
                <tr className="align-middle" key={admissionClass.id}>
                  <th className="px-6 py-5 font-semibold text-slate-950" scope="row">
                    <span className="block">{admissionClass.name}</span>
                    <span className="mt-1 block font-mono text-xs font-normal text-slate-500">
                      {admissionClass.id}
                    </span>
                  </th>
                  <td className="px-4 py-5 text-sm font-semibold text-slate-800">
                    {admissionClass.totalSeats}
                  </td>
                  <td className="px-4 py-5 text-sm text-slate-700">{admissionClass.heldSeats}</td>
                  <td className="px-4 py-5 text-sm text-slate-700">
                    {admissionClass.confirmedSeats}
                  </td>
                  <td className="px-4 py-5">
                    <Badge tone={admissionClass.availableSeats > 0 ? "success" : "danger"}>
                      {String(admissionClass.availableSeats)}
                    </Badge>
                  </td>
                  <td className="w-48 px-4 py-5">
                    <CapacityBar
                      label={`${admissionClass.name} utilization`}
                      occupiedSeats={admissionClass.heldSeats + admissionClass.confirmedSeats}
                      totalSeats={admissionClass.totalSeats}
                    />
                    <span className="sr-only">{utilization}% utilized</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      aria-label={`View details for ${admissionClass.name}`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      to={`/admin/classes/${admissionClass.id}`}
                    >
                      Details
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
