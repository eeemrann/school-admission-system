import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "default" | "soft" | "accent";
}

export function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardTones[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

const cardTones: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  soft: "border-slate-200/80 bg-slate-50/80",
  accent: "border-indigo-100 bg-indigo-50/60",
};
