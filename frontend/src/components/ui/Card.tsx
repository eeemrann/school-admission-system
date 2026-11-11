import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "default" | "soft" | "accent";
}

export function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_8px_24px_rgba(16,42,67,0.05)] transition-shadow duration-200 sm:p-6 ${cardTones[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

const cardTones: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-brand-border/90 bg-white",
  soft: "border-brand-border/80 bg-white/75",
  accent: "border-indigo-100 bg-brand-indigo-soft/70",
};
