import { act, render, screen } from "@testing-library/react";
import { ReservationCountdown } from "./ReservationCountdown";
import { formatRemainingTime } from "./countdown";

describe("ReservationCountdown", () => {
  it("shows server-derived MM:SS time, progresses every second, and cleans up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00.000Z"));
    const onReachedZero = vi.fn();
    const expiresAt = "2026-11-10T12:01:30.000Z";
    const view = render(
      <ReservationCountdown expiresAt={expiresAt} onReachedZero={onReachedZero} />,
    );

    expect(screen.getByText("01:30")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("01:29")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(89_000));
    expect(onReachedZero).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Time reached — refresh to verify")).toBeInTheDocument();

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reconstructs remaining time from the expiration timestamp after refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:05:55.000Z"));

    render(<ReservationCountdown expiresAt="2026-11-10T12:06:00.000Z" />);

    expect(screen.getByText("00:05")).toBeInTheDocument();
  });

  it("pads minutes and seconds without truncating long durations", () => {
    expect(formatRemainingTime(90)).toBe("01:30");
    expect(formatRemainingTime(545)).toBe("09:05");
    expect(formatRemainingTime(59)).toBe("00:59");
    expect(formatRemainingTime(1)).toBe("00:01");
    expect(formatRemainingTime(0)).toBe("00:00");
    expect(formatRemainingTime(6_000)).toBe("100:00");
  });

  it("shows the server-confirmed expired state", () => {
    render(<ReservationCountdown expiresAt="2026-11-10T12:00:00.000Z" isAuthoritativelyExpired />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });
});
