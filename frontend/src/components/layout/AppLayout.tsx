import { GraduationCap } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink className="mr-auto flex items-center gap-3" to="/">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-700 text-white shadow-sm">
              <GraduationCap aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-slate-950">
                School Admission
              </span>
              <span className="block text-xs text-slate-500">Portal foundation</span>
            </span>
          </NavLink>
          <nav
            aria-label="Primary navigation"
            className="order-3 flex w-full gap-1 overflow-x-auto pb-1 sm:order-2 sm:w-auto sm:pb-0"
          >
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
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
            <span className="hidden text-xs text-slate-500 sm:inline">Registration number</span>
            <span
              className="max-w-36 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              title={studentId ?? "Not selected"}
            >
              {studentId ?? "Not selected"}
            </span>
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
