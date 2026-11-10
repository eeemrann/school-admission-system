import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function LandingPage() {
  return (
    <div className="space-y-16 py-4 sm:py-10">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-800">
            <Sparkles aria-hidden="true" className="size-3.5" /> Admissions, made clear
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl sm:leading-[1.08]">
            A calmer way to move from interest to enrolment.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            The School Admission Portal brings class availability, student applications, and
            administrator class setup into one dependable workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/student/classes">
              <Button size="lg">
                Open student portal <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </Link>
            <Link to="/admin">
              <Button size="lg" variant="secondary">
                Open administrator area
              </Button>
            </Link>
          </div>
        </div>
        <Card className="relative overflow-hidden border-indigo-100 bg-indigo-950 p-7 text-white shadow-xl sm:p-9">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-indigo-800/50" />
          <div className="relative">
            <p className="text-sm font-semibold text-indigo-200">Built for confident decisions</p>
            <div className="mt-8 space-y-5">
              {[
                "Live class availability from the API",
                "A clear student application history",
                "A focused foundation for future workflows",
              ].map((item) => (
                <div className="flex gap-3" key={item}>
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-emerald-300"
                  />
                  <p className="text-sm leading-6 text-indigo-50">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 border-t border-indigo-800 pt-5 text-xs leading-5 text-indigo-200">
              This frontend foundation connects to the existing ASP.NET Core API. It does not add
              authentication or bypass backend business rules.
            </div>
          </div>
        </Card>
      </section>
      <section className="grid gap-4 md:grid-cols-3" aria-label="Portal capabilities">
        <Capability
          icon={ShieldCheck}
          title="Trust the source"
          description="Seat counters and application statuses come from the transactional backend."
        />
        <Capability
          icon={CheckCircle2}
          title="Stay oriented"
          description="Simple navigation and clear states keep each task easy to understand."
        />
        <Capability
          icon={Sparkles}
          title="Ready to grow"
          description="Feature boundaries leave room for holds, confirmations, and expiry refresh in later phases."
        />
      </section>
    </div>
  );
}

function Capability({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <Card tone="soft">
      <Icon aria-hidden="true" className="size-5 text-indigo-700" />
      <h2 className="mt-5 font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Card>
  );
}
