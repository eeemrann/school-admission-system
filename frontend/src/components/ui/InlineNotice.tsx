import type { ReactNode } from "react";

type NoticeTone = "info" | "success" | "error";

export function InlineNotice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: NoticeTone;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${noticeTones[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

const noticeTones: Record<NoticeTone, string> = {
  info: "border-indigo-100 bg-indigo-50 text-indigo-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};
