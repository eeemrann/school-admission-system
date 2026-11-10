import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">404</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          That destination is not part of the current admission portal.
        </p>
        <Link className="mt-6 inline-block" to="/">
          <Button>Return to overview</Button>
        </Link>
      </Card>
    </div>
  );
}
