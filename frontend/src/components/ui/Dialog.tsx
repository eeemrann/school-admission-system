import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";

interface DialogProps {
  ariaDescribedBy?: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ ariaDescribedBy, open, title, onClose, children }: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const previouslyFocused = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

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
        aria-describedby={ariaDescribedBy}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-950" id={titleId}>
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

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface ConfirmationDialogProps extends Omit<DialogProps, "children"> {
  description: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  isLoading,
  ...props
}: ConfirmationDialogProps) {
  const descriptionId = useId();

  return (
    <Dialog {...props} ariaDescribedBy={descriptionId}>
      <p className="text-sm leading-6 text-slate-600" id={descriptionId}>
        {description}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button isLoading={isLoading} variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
