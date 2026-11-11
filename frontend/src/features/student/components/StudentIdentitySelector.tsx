import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useStudentIdentity } from "../../../hooks/useStudentIdentity";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";

export function StudentIdentitySelector() {
  const { studentId, studentName, setStudentIdentity, clearStudentId } = useStudentIdentity();
  const [draft, setDraft] = useState(studentId ?? "");
  const [nameDraft, setNameDraft] = useState(studentName ?? "");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setDraft(studentId ?? "");
    setNameDraft(studentName ?? "");
  }, [studentId, studentName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = setStudentIdentity(draft, nameDraft);
    setError(result.error);
  }

  return (
    <Card className="relative overflow-hidden border-indigo-100/80 bg-white" tone="soft">
      <div className="pointer-events-none absolute right-0 top-0 size-40 rounded-full bg-indigo-100/50 blur-3xl" />
      <div className="relative -mx-5 -mt-5 mb-5 flex items-start gap-3 border-b border-indigo-100 bg-brand-indigo-soft/55 px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-indigo shadow-sm">
          <Fingerprint aria-hidden="true" className="size-5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-extrabold tracking-tight text-slate-950">
              {studentId ? "Your student profile" : "Select your student identity"}
            </h2>
            {studentId ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                Identity selected
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Enter your 17-digit birth registration number to view and manage applications. A name is
            optional and is used only as a local display label.
          </p>
        </div>
      </div>
      <form className="relative space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            autoComplete="name"
            hint="Optional display name; it is not sent to the API."
            label="Student name (optional)"
            onChange={(event) => {
              setNameDraft(event.target.value);
              if (error) setError(undefined);
            }}
            placeholder="Enter the student's full name"
            value={nameDraft}
          />
          <Input
            autoComplete="off"
            hint="Enter the 17-digit number printed on the birth certificate. It is an assignment identity selector, not a secure login."
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
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
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
