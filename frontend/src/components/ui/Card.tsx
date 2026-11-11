import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "default" | "soft" | "accent";
}

export function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6 ${cardTones[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

const cardTones: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-brand-border bg-white",
  soft: "border-brand-border/80 bg-slate-50/80",
  accent: "border-indigo-100 bg-brand-indigo-soft/70",
};
