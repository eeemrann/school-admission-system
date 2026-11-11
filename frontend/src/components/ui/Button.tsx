import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className = "",
    variant = "primary",
    size = "md",
    isLoading = false,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold shadow-sm transition duration-150 ease-out hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-indigo disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-indigo text-white shadow-[0_8px_18px_rgba(79,70,229,0.2)] hover:bg-indigo-700 focus-visible:outline-brand-indigo",
  secondary:
    "border border-brand-border bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-600",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-600",
  danger: "bg-rose-700 text-white hover:bg-rose-800 focus-visible:outline-rose-700",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};
