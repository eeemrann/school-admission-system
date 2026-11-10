import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { InlineNotice } from "../../../components/ui/InlineNotice";
import { Input } from "../../../components/ui/Input";
import { getErrorMessage } from "../../../components/ui/errorMessage";
import { useCreateClassMutation } from "../queries";

interface CreateClassDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateClassDialog({ open, onClose, onCreated }: CreateClassDialogProps) {
  const [name, setName] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [formError, setFormError] = useState<string>();
  const createMutation = useCreateClassMutation();

  useEffect(() => {
    if (open) {
      setFormError(undefined);
    }
  }, [open]);

  async function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedSeats = Number(totalSeats);

    if (!trimmedName) {
      setFormError("Enter a class name.");
      return;
    }

    if (!Number.isInteger(parsedSeats) || parsedSeats <= 0) {
      setFormError("Enter a positive whole-number seat count.");
      return;
    }

    setFormError(undefined);

    try {
      await createMutation.mutateAsync({ name: trimmedName, totalSeats: parsedSeats });
      setName("");
      setTotalSeats("");
      onCreated();
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create a class">
      <p className="text-sm leading-6 text-slate-600">
        Add a published class offering. The API validates the name and capacity before saving it.
      </p>
      <form className="mt-5 space-y-4" onSubmit={submitClass}>
        <Input
          autoComplete="off"
          label="Class name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Class 6 - Morning Shift"
          value={name}
        />
        <Input
          inputMode="numeric"
          label="Total seats"
          min="1"
          onChange={(event) => setTotalSeats(event.target.value)}
          placeholder="120"
          type="number"
          value={totalSeats}
        />
        {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={createMutation.isPending} type="submit">
            Create class
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
