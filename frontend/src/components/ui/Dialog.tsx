import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-slate-950/40"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-950" id="dialog-title">
            {title}
          </h2>
          <Button
            ref={closeButtonRef}
            aria-label="Close dialog"
            className="-mr-2 -mt-2"
            size="sm"
            variant="ghost"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmationDialogProps extends Omit<DialogProps, "children"> {
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  description,
  confirmLabel = "Confirm",
  onConfirm,
  isLoading,
  ...props
}: ConfirmationDialogProps) {
  return (
    <Dialog {...props}>
      <p className="text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button isLoading={isLoading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
