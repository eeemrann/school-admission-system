import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Search,
  ShieldCheck,
  TicketCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

const primaryLinkClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(57,73,171,0.24)] transition duration-150 hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-indigo";

const secondaryLinkClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition duration-150 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600";

export function LandingPage() {
  return (
    <div className="-mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
      <section className="relative overflow-hidden border-b border-brand-border/80 bg-[radial-gradient(circle_at_78%_18%,rgba(224,231,255,0.9),transparent_36%),linear-gradient(135deg,#fff_0%,#f8fbff_55%,#eef2ff_100%)]">
        <div className="pointer-events-none absolute -right-32 -top-44 size-[32rem] rounded-full border-[56px] border-indigo-100/40 blur-sm" />
        <div className="pointer-events-none absolute -bottom-56 -left-40 size-[28rem] rounded-full bg-indigo-100/35 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.85fr] lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[10px] font-bold text-brand-indigo shadow-sm">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-indigo" />
              School admission platform
            </p>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] text-brand-navy sm:text-6xl lg:text-[4.3rem]">
              A clearer path to your next school admission.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Discover available classes, reserve a seat for a limited time, and keep every step of
              your application in one dependable place.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className={primaryLinkClass} to="/student/classes">
                Browse available classes <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link className={secondaryLinkClass} to="/admin">
                Open administrator portal
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
              <TrustPoint>Live seat availability</TrustPoint>
              <TrustPoint>Server-backed reservations</TrustPoint>
              <TrustPoint>Clear application history</TrustPoint>
            </div>
          </div>

          <AdmissionJourney />
        </div>
      </section>

      <section aria-label="Platform signals" className="border-b border-brand-border/80 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-brand-border/70 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          <Signal value="Live" label="availability from the admission API" tone="indigo" />
          <Signal
            value="Time-boxed"
            label="reservation windows for confident decisions"
            tone="emerald"
          />
          <Signal value="1 place" label="one clear application history" tone="amber" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionIntro
          eyebrow="How admission works"
          title="A simple process with clear next steps."
          description="The platform keeps availability visible and leaves authoritative admission decisions with the backend."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <ProcessCard
            description="Compare class and shift availability using live counters from the admission API."
            icon={Search}
            number="01"
            title="Discover a class"
          />
          <ProcessCard
            description="Submit an application and receive a temporary reservation with a server-provided expiry."
            icon={TicketCheck}
            number="02"
            title="Reserve your seat"
          />
          <ProcessCard
            description="Pay the simulated admission fee to confirm, then track the final status in history."
            icon={ClipboardCheck}
            number="03"
            title="Confirm admission"
          />
        </div>
      </section>

      <section className="border-y border-brand-border bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionIntro
            eyebrow="Built for confident decisions"
            title="Everything important stays easy to see."
            description="A focused experience for students, parents, and administrators using the existing admission workflows."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <CapabilityCard
              description="See total, held, confirmed, and available seats from the transactional backend."
              icon={ShieldCheck}
              title="Live seat availability"
            />
            <CapabilityCard
              description="Temporary reservations, expiry handling, and capacity protection work together behind the scenes."
              icon={Clock3}
              title="Reliable seat reservation"
            />
            <CapabilityCard
              description="Review held, confirmed, expired, and cancelled applications whenever you return."
              icon={ClipboardCheck}
              title="Application status tracking"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-brand-navy px-6 py-12 text-white shadow-[0_20px_48px_rgba(11,31,58,0.18)] sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border-[36px] border-white/5" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
              Ready when you are
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Find a class and take the next step with confidence.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              Browse the current catalogue, select your assignment-level identity, and manage your
              application from one clear student workspace.
            </p>
          </div>
          <Link
            className="relative mt-8 inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-brand-navy shadow-sm transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mt-0"
            to="/student/classes"
          >
            Browse available classes <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-navy text-white">
              <GraduationCap aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-navy">School Admission</p>
              <p className="text-xs text-slate-500">A focused admission workspace</p>
            </div>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600"
          >
            <Link className="hover:text-brand-indigo" to="/student/classes">
              Student portal
            </Link>
            <Link className="hover:text-brand-indigo" to="/student/applications">
              My applications
            </Link>
            <Link className="hover:text-brand-indigo" to="/admin">
              Administration
            </Link>
          </nav>
          <p className="max-w-sm text-xs leading-5 text-slate-500 lg:text-right">
            The selected birth registration number is an assignment-level identity selector, not
            authentication or proof of identity.
          </p>
        </div>
      </footer>
    </div>
  );
}

function AdmissionJourney() {
  const steps = [
    { icon: Search, label: "Explore available classes" },
    { icon: TicketCheck, label: "Reserve a seat temporarily" },
    { icon: WalletCards, label: "Pay admission fee to confirm" },
    { icon: ClipboardCheck, label: "Track your application" },
  ];

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy p-6 text-white shadow-[0_24px_60px_rgba(16,42,67,0.24)] sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full border-[42px] border-indigo-300/10" />
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">
            Your admission journey
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">From discovery to decision.</h2>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-indigo-200">
          <GraduationCap aria-hidden="true" className="size-5" />
        </span>
      </div>
      <ol className="mt-7 space-y-5">
        {steps.map(({ icon: Icon, label }, index) => (
          <li className="relative flex gap-4" key={label}>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="absolute left-4 top-9 h-8 w-px bg-white/15" />
            ) : null}
            <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-indigo-300/40 bg-indigo-500/20 text-xs font-bold text-indigo-100">
              {index + 1}
            </span>
            <div className="flex items-center gap-3 pt-1">
              <Icon aria-hidden="true" className="size-4 text-indigo-200" />
              <span className="text-sm font-semibold text-slate-100">{label}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-xs leading-5 text-slate-300">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-300" />
        Seat availability and application status remain backed by the API.
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] font-semibold text-slate-300">
        <span>Workflow status</span>
        <span className="inline-flex items-center gap-1.5 text-emerald-200">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />
          Ready to begin
        </span>
      </div>
    </div>
  );
}

function Signal({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "indigo" | "emerald" | "amber";
}) {
  const valueClass = {
    indigo: "text-brand-indigo",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <div className="flex items-center gap-4 px-0 py-5 sm:px-8 sm:py-6 first:sm:pl-0 last:sm:pr-0">
      <p className={`text-2xl font-extrabold tracking-[-0.04em] ${valueClass}`}>{value}</p>
      <p className="max-w-44 text-xs font-semibold leading-5 text-slate-500">{label}</p>
    </div>
  );
}

function SectionIntro({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-indigo">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function ProcessCard({
  description,
  icon: Icon,
  number,
  title,
}: {
  description: string;
  icon: LucideIcon;
  number: string;
  title: string;
}) {
  return (
    <Card className="relative overflow-hidden border-brand-border bg-white p-6 sm:p-7">
      <span className="absolute right-6 top-5 text-4xl font-bold tracking-tight text-slate-100">
        {number}
      </span>
      <span className="grid size-11 place-items-center rounded-xl bg-brand-indigo-soft text-brand-indigo">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-7 text-lg font-bold text-ink-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </Card>
  );
}

function CapabilityCard({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Card tone="soft" className="border-brand-border/80 p-6 sm:p-7">
      <span className="grid size-11 place-items-center rounded-xl bg-white text-brand-indigo shadow-sm">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-6 text-lg font-bold text-ink-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </Card>
  );
}

function TrustPoint({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Check aria-hidden="true" className="size-3.5 text-brand-success" />
      {children}
    </span>
  );
}
