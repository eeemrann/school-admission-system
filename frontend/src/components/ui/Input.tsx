import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, hint, className = "", ...props },
  ref,
) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error)}
        className={`min-h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${error ? "border-rose-400" : "border-slate-300"} ${className}`}
        {...props}
      />
      {hint ? (
        <p id={`${inputId}-hint`} className="text-xs leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
});
