import { ArrowUpRight, GraduationCap } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useStudentIdentity } from "../../hooks/useStudentIdentity";

const navigation = [
  { to: "/", label: "Overview", end: true },
  { to: "/student/classes", label: "Student portal" },
  { to: "/student/applications", label: "My applications" },
  { to: "/admin", label: "Administration" },
];

export function AppLayout() {
  const { studentId } = useStudentIdentity();
  const maskedStudentId = studentId ? maskStudentId(studentId) : "Not selected";

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <header className="sticky top-0 z-20 border-b border-brand-border/80 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <NavLink className="mr-auto flex items-center gap-3" to="/">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-navy text-white shadow-sm">
              <GraduationCap aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-ink-950">
                School Admission
              </span>
              <span className="block text-xs font-medium text-slate-500">Admission platform</span>
            </span>
          </NavLink>
          <nav
            aria-label="Primary navigation"
            className="order-3 flex w-full gap-1 overflow-x-auto pb-1 sm:order-2 sm:w-auto sm:pb-0"
          >
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-brand-indigo-soft text-brand-indigo" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
                }
                end={item.end}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="order-2 flex items-center gap-2 sm:order-3">
            <span className="hidden text-xs text-slate-500 sm:inline">Student identity</span>
            <span
              aria-label={
                studentId
                  ? `Registration number ending in ${studentId.slice(-4)}`
                  : "No student identity selected"
              }
              className="max-w-36 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {maskedStudentId}
            </span>
            {studentId ? (
              <NavLink
                aria-label="Change student identity"
                className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-indigo hover:bg-brand-indigo-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-indigo"
                to="/student/classes"
              >
                Change <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </NavLink>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
        Birth registration numbers identify the current browser session for this assignment; they
        are not authentication.
      </footer>
    </div>
  );
}

function maskStudentId(studentId: string): string {
  return `•••••••••••••${studentId.slice(-4)}`;
}
