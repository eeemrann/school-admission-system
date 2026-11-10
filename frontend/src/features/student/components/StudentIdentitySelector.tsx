import { useEffect, useState } from "react";
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = setStudentId(draft);
    setError(result.error);
  }

  return (
    <Card tone="soft">
      <form className="flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleSubmit}>
        <div className="min-w-0 flex-1">
          <Input
            error={error}
            hint="This is an assignment-level identity selector, not a secure login or proof of identity."
            label="Birth Registration Number"
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(undefined);
            }}
            placeholder="Enter your birth registration number"
            value={draft}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">{studentId ? "Change number" : "Use this number"}</Button>
          {studentId ? (
            <Button type="button" variant="ghost" onClick={clearStudentId}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
