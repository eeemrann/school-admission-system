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
      className={`inline-flex items-center gap-2 text-sm font-semibold ${isAuthoritativelyExpired ? "text-rose-700" : isChecking || reachedZero ? "text-amber-800" : "text-indigo-800"}`}
      title="The server remains authoritative for reservation expiry"
    >
      <Clock3 aria-hidden="true" className="size-4" />
      <span aria-live="off">{label}</span>
    </span>
  );
}
