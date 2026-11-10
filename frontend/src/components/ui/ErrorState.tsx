import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { getErrorMessage } from "./errorMessage";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({
  error,
  onRetry,
  title = "We could not load this yet",
}: ErrorStateProps) {
  return (
    <Card className="border-rose-200 bg-rose-50/50">
      <div aria-live="assertive" role="alert" className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-700" />
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{getErrorMessage(error)}</p>
          </div>
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
