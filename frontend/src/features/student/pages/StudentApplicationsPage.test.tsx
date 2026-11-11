import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { StudentApplicationsPage } from "./StudentApplicationsPage";
import {
  jsonResponse,
  problemResponse,
  renderWithProviders,
} from "../../../test/renderWithProviders";

const heldApplication = {
  holdId: "h_22222222222222222222222222222222",
  classId: "c_22222222222222222222222222222222",
  className: "Class 7 - Day Shift",
  status: "HELD",
  expiresAt: "2099-11-10T12:10:00.000Z",
};

describe("StudentApplicationsPage", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8080"));

  it("shows only the identity empty state when no student is selected", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />);

    expect(screen.getByText("Select a birth registration number")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("No applications yet")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders all application statuses and only offers actions for held applications", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([
            heldApplication,
            { ...heldApplication, holdId: "h_confirmed", status: "CONFIRMED" },
            { ...heldApplication, holdId: "h_expired", status: "EXPIRED" },
            { ...heldApplication, holdId: "h_cancelled", status: "CANCELLED" },
          ]),
        ),
    );
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    expect(await screen.findAllByText("Class 7 - Day Shift")).toHaveLength(4);
    expect(screen.getAllByText("HELD")).toHaveLength(1);
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText("EXPIRED")).toBeInTheDocument();
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm admission/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel reservation/i })).toBeInTheDocument();
  });

  it("confirms a held application through the dialog and refreshes history", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([heldApplication]))
      .mockResolvedValueOnce(jsonResponse({ holdId: heldApplication.holdId, status: "CONFIRMED" }))
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, status: "CONFIRMED" }]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    fireEvent.click(await screen.findByRole("button", { name: /confirm admission/i }));
    const dialog = await screen.findByRole("dialog", { name: /confirm admission/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm admission/i }));

    expect(await screen.findByText(/Admission confirmed\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("CONFIRMED")).toBeInTheDocument());
    const confirmRequest = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(confirmRequest[0]).toBe(`http://localhost:8080/holds/${heldApplication.holdId}/confirm`);
    expect(new Headers(confirmRequest[1].headers).get("X-Student-Id")).toBe("20152691234560049");
  });

  it("cancels a held application and keeps the history row", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([heldApplication]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, status: "CANCELLED" }]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    fireEvent.click(await screen.findByRole("button", { name: /cancel reservation/i }));
    const dialog = await screen.findByRole("dialog", { name: /cancel reservation/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel reservation/i }));

    expect(await screen.findByText(/Reservation cancelled\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("CANCELLED")).toBeInTheDocument());
    expect(fetchMock.mock.calls[1][0]).toBe(
      `http://localhost:8080/holds/${heldApplication.holdId}`,
    );
  });

  it("surfaces an expired confirmation failure and refreshes authoritative history", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([heldApplication]))
      .mockResolvedValueOnce(
        problemResponse("HOLD_EXPIRED", "The hold has expired and cannot be changed."),
      )
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, status: "EXPIRED" }]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    fireEvent.click(await screen.findByRole("button", { name: /confirm admission/i }));
    const dialog = await screen.findByRole("dialog", { name: /confirm admission/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm admission/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The hold has expired");
    await waitFor(() => expect(screen.getByText("EXPIRED")).toBeInTheDocument());
  });

  it("does not leak cached history when the selected student changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, className: "Student A class" }]))
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, className: "Student B class" }]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    expect(await screen.findByText("Student A class")).toBeInTheDocument();
    const identityInput = screen.getByLabelText("Birth Registration Number");
    fireEvent.change(identityInput, { target: { value: "20152691234560050" } });
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));

    expect(await screen.findByText("Student B class")).toBeInTheDocument();
    expect(screen.queryByText("Student A class")).not.toBeInTheDocument();
    const historyRequest = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(historyRequest[1].headers).get("X-Student-Id")).toBe("20152691234560050");
  });

  it("shows an empty state for a student with no history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560051" });

    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
  });

  it("shows an API history failure with a retryable error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          problemResponse("INTERNAL_ERROR", "The history service is unavailable.", 500),
        ),
    );
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The history service is unavailable.",
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("handles the confirmed-application cancellation conflict", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([heldApplication]))
      .mockResolvedValueOnce(
        problemResponse(
          "CONFIRMED_HOLD_CANNOT_CANCEL",
          "A confirmed admission cannot be cancelled.",
        ),
      )
      .mockResolvedValueOnce(jsonResponse([{ ...heldApplication, status: "CONFIRMED" }]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    fireEvent.click(await screen.findByRole("button", { name: /cancel reservation/i }));
    const dialog = await screen.findByRole("dialog", { name: /cancel reservation/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel reservation/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A confirmed admission cannot be cancelled.",
    );
    await waitFor(() => expect(screen.getByText("CONFIRMED")).toBeInTheDocument());
  });

  it("refreshes authoritative hold status when a countdown reaches zero", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:09:59.000Z"));
    let resolveHold: ((response: Response) => void) | undefined;
    const authoritativeHold = new Promise<Response>((resolve) => {
      resolveHold = resolve;
    });
    const countdownApplication = {
      ...heldApplication,
      expiresAt: "2026-11-10T12:10:00.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([countdownApplication]))
      .mockReturnValueOnce(authoritativeHold);
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<StudentApplicationsPage />, { studentId: "20152691234560049" });

    await vi.waitFor(() => expect(screen.getByText("00:01")).toBeInTheDocument());
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("EXPIRED")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm admission/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel reservation/i })).toBeDisabled();

    resolveHold?.(
      jsonResponse({
        holdId: heldApplication.holdId,
        classId: heldApplication.classId,
        status: "EXPIRED",
        expiresAt: heldApplication.expiresAt,
      }),
    );
    await vi.waitFor(() => expect(screen.getByText("EXPIRED")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /confirm admission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel reservation/i })).not.toBeInTheDocument();
  });
});
