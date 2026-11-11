import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CompactIdProps {
  value: string;
  label?: string;
}

export function CompactId({ value, label = "identifier" }: CompactIdProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copyIdentifier() {
    try {
      if (!navigator.clipboard) {
        return;
      }

      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      // Clipboard access is a convenience and may be unavailable in a restricted browser.
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <code className="truncate" title={`Full ${label}: ${value}`}>
        {formatCompactId(value)}
      </code>
      <button
        aria-label={copied ? `${label} copied` : `Copy full ${label}`}
        className="inline-grid size-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-brand-indigo focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-indigo"
        onClick={() => void copyIdentifier()}
        title={copied ? "Copied" : `Copy full ${label}`}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5 text-emerald-600" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </span>
  );
}

function formatCompactId(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 7)}…${value.slice(-6)}`;
}
