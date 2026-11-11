import {
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Home,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useStudentIdentity } from "../../hooks/useStudentIdentity";

const navigation = [
  { to: "/", label: "Overview", end: true, icon: Home },
  { to: "/student/classes", label: "Browse classes", icon: BookOpen },
  { to: "/student/applications", label: "My applications", icon: ClipboardList },
  { to: "/admin", label: "Administration", icon: Shield },
];

export function AppLayout() {
  const { studentId } = useStudentIdentity();
  const maskedStudentId = studentId ? maskStudentId(studentId) : "Not selected";

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <header className="sticky top-0 z-20 border-b border-brand-border/80 bg-white/90 shadow-[0_1px_16px_rgba(16,42,67,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink className="mr-auto flex items-center gap-3" to="/">
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-2xl bg-brand-navy text-white shadow-[0_6px_16px_rgba(16,42,67,0.2)]">
              <span className="absolute -right-2 -top-2 size-5 rounded-full bg-indigo-400/60" />
              <GraduationCap aria-hidden="true" className="relative size-5" />
            </span>
            <span>
              <span className="block text-[13px] font-extrabold tracking-[-0.01em] text-ink-950">
                School Admission
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Admissions workspace
              </span>
            </span>
          </NavLink>
          <nav
            aria-label="Primary navigation"
            className="order-3 flex w-full gap-1 overflow-x-auto pb-0.5 sm:order-2 sm:w-auto sm:pb-0"
          >
            {navigation.map(({ icon: Icon, ...item }) => (
              <PrimaryNavLink Icon={Icon} item={item} key={item.to} />
            ))}
          </nav>
          <div className="order-2 flex items-center gap-2 sm:order-3">
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:inline">
              Active student
            </span>
            <span
              aria-label={
                studentId
                  ? `Registration number ending in ${studentId.slice(-4)}`
                  : "No student identity selected"
              }
              className={`max-w-36 truncate rounded-full border px-3 py-1.5 text-xs font-bold ${studentId ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-brand-border/70 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span className="font-semibold text-slate-600">School Admission · Local workspace</span>
        <span>
          Birth registration numbers identify this browser session; they are not authentication.
        </span>
      </footer>
    </div>
  );
}

function PrimaryNavLink({
  Icon,
  item,
}: {
  Icon: LucideIcon;
  item: { to: string; label: string; end?: boolean };
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `group inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isActive ? "bg-brand-indigo-soft text-brand-indigo" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
      }
      end={item.end}
      to={item.to}
    >
      <Icon aria-hidden="true" className="size-3.5 transition-transform group-hover:scale-105" />
      {item.label}
    </NavLink>
  );
}

function maskStudentId(studentId: string): string {
  return `•••••••••••••${studentId.slice(-4)}`;
}
