export function getRemainingSeconds(expiresAt: string, now = Date.now()): number {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiry - now) / 1000));
}

export function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
