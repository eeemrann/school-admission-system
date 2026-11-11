import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const navigation = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/classes", label: "Classes", icon: BookOpen },
];

const breadcrumbLabels: Record<string, string> = {
  classes: "Classes",
};

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(readDesktopMediaQuery);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpenRef = useRef(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(min-width: 1024px)");
    if (!mediaQuery) {
      return;
    }

    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);
    updateDesktopState();
    mediaQuery.addEventListener?.("change", updateDesktopState);
    return () => mediaQuery.removeEventListener?.("change", updateDesktopState);
  }, []);

  useEffect(() => {
    if (mobileOpen && !wasMobileOpenRef.current) {
      closeButtonRef.current?.focus();
    }
    if (!mobileOpen && wasMobileOpenRef.current) {
      menuButtonRef.current?.focus();
    }
    wasMobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const sidebarInteractive = isDesktop || mobileOpen;

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      {mobileOpen ? (
        <button
          aria-label="Close administrator navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Administrator navigation"
        aria-hidden={!sidebarInteractive}
        id="administrator-navigation"
        aria-modal={mobileOpen && !isDesktop ? "true" : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden bg-brand-navy text-slate-200 shadow-[12px_0_36px_rgba(16,42,67,0.12)] transition-transform duration-200 motion-reduce:transition-none lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        role={mobileOpen && !isDesktop ? "dialog" : "complementary"}
      >
        <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-2xl bg-indigo-500 text-white shadow-[0_8px_20px_rgba(99,102,241,0.25)]">
            <span className="absolute -right-2 -top-2 size-5 rounded-full bg-indigo-300/60" />
            <GraduationCap aria-hidden="true" className="relative size-5" />
          </span>
          <div>
            <Link
              className="block text-sm font-extrabold tracking-tight text-white"
              tabIndex={sidebarInteractive ? undefined : -1}
              to="/admin"
            >
              School Admission
            </Link>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Operations console
            </span>
          </div>
          <button
            aria-label="Close administrator navigation"
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 lg:hidden"
            ref={closeButtonRef}
            tabIndex={sidebarInteractive ? undefined : -1}
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <nav aria-label="Administrator sections" className="flex-1 space-y-1 px-4 py-7">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Workspace
          </p>
          {navigation.map(({ icon: Icon, ...item }) => (
            <NavLink
              className={({ isActive }) =>
                `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${isActive ? "bg-indigo-500/20 text-white shadow-[inset_3px_0_0_#a5b4fc]" : "text-slate-400 hover:bg-white/10 hover:text-white"}`
              }
              end={item.end}
              key={item.to}
              tabIndex={sidebarInteractive ? undefined : -1}
              to={item.to}
            >
              <Icon
                aria-hidden="true"
                className="size-5 transition-transform group-hover:scale-105"
              />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-300">
          <ShieldAlert aria-hidden="true" className="mb-2 size-4 text-amber-300" />
          <p className="font-semibold text-white">Local operations mode</p>
          <p className="mt-1 text-slate-400">
            Administrator authentication is outside the current API contract.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_16px_rgba(16,42,67,0.04)] backdrop-blur-xl">
          <div className="flex min-h-20 items-center gap-4 px-4 sm:px-6 lg:px-10">
            <button
              aria-controls="administrator-navigation"
              aria-expanded={mobileOpen}
              aria-label="Open administrator navigation"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
              ref={menuButtonRef}
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-slate-500">
              {getBreadcrumbs(location.pathname).map((breadcrumb, index) => (
                <span
                  className="flex min-w-0 items-center gap-2"
                  key={`${breadcrumb.label}-${index}`}
                >
                  {index > 0 ? (
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
                  ) : null}
                  {breadcrumb.to ? (
                    <Link className="truncate hover:text-indigo-700" to={breadcrumb.to}>
                      {breadcrumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-bold text-slate-900">{breadcrumb.label}</span>
                  )}
                </span>
              ))}
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:inline-flex">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
              API workspace live
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <Outlet />
        </main>
        <footer className="px-4 pb-8 text-center text-xs text-slate-500 sm:px-6 lg:px-10">
          Administrator routes are not authenticated; access control is outside the current
          assignment contract.
        </footer>
      </div>
    </div>
  );
}

function getBreadcrumbs(pathname: string): Array<{ label: string; to?: string }> {
  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ label: string; to?: string }> = [
    { label: "Administration", to: "/admin" },
  ];

  if (parts.length > 1) {
    breadcrumbs.push({ label: breadcrumbLabels[parts[1]] ?? "Class details" });
  }

  if (parts.length > 2) {
    breadcrumbs.push({ label: "Details" });
  }

  return breadcrumbs;
}

function readDesktopMediaQuery(): boolean {
  return window.matchMedia?.("(min-width: 1024px)").matches ?? true;
}
