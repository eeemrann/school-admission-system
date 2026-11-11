import { Pencil } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";
import { getErrorMessage } from "../../../components/ui/errorMessage";
import { useUpdateClassMutation } from "../queries";

interface EditClassNameDialogProps {
  classId: string;
  currentName: string;
  currentTotalSeats: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditClassNameDialog({
  classId,
  currentName,
  currentTotalSeats,
  onClose,
  onSaved,
  open,
}: EditClassNameDialogProps) {
  const [name, setName] = useState(currentName);
  const [totalSeats, setTotalSeats] = useState(String(currentTotalSeats));
  const [formError, setFormError] = useState<string>();
  const updateMutation = useUpdateClassMutation();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setTotalSeats(String(currentTotalSeats));
      setFormError(undefined);
    }
  }, [currentName, currentTotalSeats, open]);

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setFormError("Enter a class name.");
      return;
    }

    const parsedSeats = Number(totalSeats);
    if (!Number.isInteger(parsedSeats) || parsedSeats < currentTotalSeats) {
      setFormError(`Enter a whole-number capacity of at least ${currentTotalSeats}.`);
      return;
    }

    setFormError(undefined);

    try {
      await updateMutation.mutateAsync({
        classId,
        request: { name: trimmedName, totalSeats: parsedSeats },
      });
      onSaved();
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      ariaDescribedBy={descriptionId}
      open={open}
      onClose={onClose}
      title="Edit class details"
    >
      <p className="text-sm leading-6 text-slate-600" id={descriptionId}>
        Give this offering a clear name and increase its capacity when needed. Existing application
        history and seat counters stay unchanged.
      </p>
      <form className="mt-5 space-y-4" onSubmit={submitDetails}>
        <Input
          autoComplete="off"
          autoFocus
          hint="Example: Class 6 — Morning Shift"
          label="Class name"
          maxLength={200}
          onChange={(event) => {
            setName(event.target.value);
            if (formError) setFormError(undefined);
          }}
          placeholder="Class 6 — Morning Shift"
          value={name}
        />
        <Input
          inputMode="numeric"
          label="Total seats"
          min={currentTotalSeats}
          onChange={(event) => {
            setTotalSeats(event.target.value);
            if (formError) setFormError(undefined);
          }}
          hint={`Capacity can increase from ${currentTotalSeats}; it cannot be reduced below existing capacity.`}
          step="1"
          type="number"
          value={totalSeats}
        />
        {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={updateMutation.isPending} type="submit">
            <Pencil aria-hidden="true" className="size-4" />
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
