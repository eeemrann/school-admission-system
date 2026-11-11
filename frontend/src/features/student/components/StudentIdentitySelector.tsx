import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useStudentIdentity } from "../../../hooks/useStudentIdentity";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";

export function StudentIdentitySelector() {
  const { studentId, setStudentId, clearStudentId } = useStudentIdentity();
  const [draft, setDraft] = useState(studentId ?? "");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setDraft(studentId ?? "");
  }, [studentId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = setStudentId(draft);
    setError(result.error);
  }

  return (
    <Card className="overflow-hidden border-indigo-100 bg-white" tone="soft">
      <div className="-mx-5 -mt-5 mb-5 flex items-start gap-3 border-b border-indigo-100 bg-brand-indigo-soft/60 px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-indigo shadow-sm">
          <Fingerprint aria-hidden="true" className="size-5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-slate-950">Choose your student identity</h2>
            {studentId ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                Identity selected
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Use your 17-digit birth registration number to view and manage your applications.
          </p>
        </div>
      </div>
      <form className="flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleSubmit}>
        <div className="min-w-0 flex-1">
          <Input
            autoComplete="off"
            error={error}
            hint="This selects the student record for this assignment. It is not a secure login or proof of identity."
            inputMode="numeric"
            label="Birth Registration Number"
            maxLength={17}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(undefined);
            }}
            placeholder="Enter 17 numeric digits"
            value={draft}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" type="submit">
            {studentId ? "Change number" : "Use this number"}
          </Button>
          {studentId ? (
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="ghost"
              onClick={clearStudentId}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
