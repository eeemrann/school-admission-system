import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatRemainingTime, getRemainingSeconds } from "./countdown";

interface ReservationCountdownProps {
  expiresAt: string;
  isAuthoritativelyExpired?: boolean;
  isChecking?: boolean;
  onReachedZero?: () => void;
}

export function ReservationCountdown({
  expiresAt,
  isAuthoritativelyExpired = false,
  isChecking = false,
  onReachedZero,
}: ReservationCountdownProps) {
  const callbackRef = useRef(onReachedZero);
  const reachedZeroRef = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(expiresAt));
  const [reachedZero, setReachedZero] = useState(() => remainingSeconds === 0);

  useEffect(() => {
    callbackRef.current = onReachedZero;
  }, [onReachedZero]);

  useEffect(() => {
    reachedZeroRef.current = false;
    const update = () => {
      const next = getRemainingSeconds(expiresAt);
      setRemainingSeconds(next);
      if (next === 0 && !reachedZeroRef.current) {
        reachedZeroRef.current = true;
        setReachedZero(true);
        callbackRef.current?.();
      }
    };

    setReachedZero(getRemainingSeconds(expiresAt) === 0);
    update();
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  const label = isAuthoritativelyExpired
    ? "Expired"
    : isChecking
      ? "Checking status…"
      : reachedZero
        ? "Time reached — refresh to verify"
        : formatRemainingTime(remainingSeconds);

  return (
    <span
      aria-label={`Reservation time: ${label}`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${isAuthoritativelyExpired ? "border-rose-200 bg-rose-50 text-rose-700" : isChecking || reachedZero ? "border-amber-200 bg-amber-50 text-amber-800" : "border-indigo-200 bg-indigo-50 text-indigo-800"}`}
      title="The server remains authoritative for reservation expiry"
    >
      <Clock3 aria-hidden="true" className="size-4" />
      <span aria-live="off">{label}</span>
    </span>
  );
}
