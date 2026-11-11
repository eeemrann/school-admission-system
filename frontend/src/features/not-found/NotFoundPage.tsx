import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="relative max-w-lg overflow-hidden text-center">
        <div className="pointer-events-none absolute -right-12 -top-14 size-36 rounded-full bg-indigo-100/70 blur-2xl" />
        <span className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-brand-indigo-soft text-brand-indigo">
          <Compass aria-hidden="true" className="size-6" />
        </span>
        <p className="eyebrow relative mt-6 text-[10px] font-bold text-indigo-700">
          404 · Off route
        </p>
        <h1 className="relative mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          That destination is not part of the current admission portal. Let’s get you back to a
          useful starting point.
        </p>
        <Link className="mt-6 inline-block" to="/">
          <Button>
            <Home aria-hidden="true" className="size-4" />
            Return to overview
          </Button>
        </Link>
      </Card>
    </div>
  );
}
