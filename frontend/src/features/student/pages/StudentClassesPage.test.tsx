import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudentClassesPage } from "./StudentClassesPage";
import {
  jsonResponse,
  problemResponse,
  renderWithProviders,
} from "../../../test/renderWithProviders";

const availableClass = {
  id: "c_11111111111111111111111111111111",
  name: "Class 6 - Morning Shift",
  totalSeats: 10,
  heldSeats: 2,
  confirmedSeats: 3,
  availableSeats: 5,
};

const createdHold = {
  holdId: "h_11111111111111111111111111111111",
  classId: availableClass.id,
  studentId: "20152691234560049",
  status: "HELD",
  expiresAt: "2099-11-10T12:10:00.000Z",
};

describe("StudentClassesPage admission creation", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8080"));

  it("shows a loading state while the class catalogue is pending", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading classes");
  });

  it("loads classes, creates a hold, sends identity, and refreshes availability", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockResolvedValueOnce(jsonResponse({ ...createdHold }, 201))
      .mockResolvedValueOnce(
        jsonResponse([{ ...availableClass, heldSeats: 3, availableSeats: 4 }]),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    expect(await screen.findByText("Class 6 - Morning Shift")).toBeInTheDocument();
    const applyButton = screen.getByRole("button", { name: /apply for admission/i });
    fireEvent.click(applyButton);

    expect(await screen.findByText("Seat temporarily reserved")).toBeInTheDocument();
    expect(screen.queryByText(createdHold.holdId)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText("4")).toBeInTheDocument();

    const holdRequest = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(holdRequest[0]).toBe(`http://localhost:8080/classes/${availableClass.id}/holds`);
    expect(new Headers(holdRequest[1].headers).get("X-Student-Id")).toBe("20152691234560049");
  });

  it("refreshes class availability automatically", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockResolvedValueOnce(
        jsonResponse([{ ...availableClass, heldSeats: 3, availableSeats: 4 }]),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    expect(await screen.findByText("Class 6 - Morning Shift")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("keeps the apply button unavailable when capacity is exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse([{ ...availableClass, availableSeats: 0, heldSeats: 7 }])),
    );
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    const button = await screen.findByRole("button", { name: /no seats available/i });
    expect(button).toBeDisabled();
  });

  it("filters the student catalogue to classes with seats", async () => {
    const fullClass = {
      ...availableClass,
      id: "c_full",
      name: "Class 5 - Full",
      availableSeats: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([availableClass, fullClass])));
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    await screen.findByText("Class 5 - Full");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter classes" }), {
      target: { value: "available" },
    });

    expect(screen.getByText("Class 6 - Morning Shift")).toBeInTheDocument();
    expect(screen.queryByText("Class 5 - Full")).not.toBeInTheDocument();
  });

  it("requires a selected student identity before an application can be submitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([availableClass]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
    );

    const button = await screen.findByRole("button", { name: /apply for admission/i });
    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the backend duplicate-application error and prevents repeat submission while pending", async () => {
    let resolveHold: ((response: Response) => void) | undefined;
    const pendingHold = new Promise<Response>((resolve) => {
      resolveHold = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockReturnValueOnce(pendingHold)
      .mockResolvedValue(jsonResponse([availableClass]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    const button = await screen.findByRole("button", { name: /apply for admission/i });
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(button).toBeDisabled();

    resolveHold?.(
      problemResponse("DUPLICATE_ACTIVE_APPLICATION", "An active application already exists."),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An active application already exists.",
    );
  });

  it("renders an understandable no-seats conflict from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([availableClass]))
        .mockResolvedValueOnce(
          problemResponse("NO_SEATS_AVAILABLE", "The class filled before submission."),
        )
        .mockResolvedValue(jsonResponse([availableClass])),
    );
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    fireEvent.click(await screen.findByRole("button", { name: /apply for admission/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The class filled before submission.",
    );
  });

  it("clears the previous student's hold notice when identity changes", async () => {
    const holdForTest = {
      ...createdHold,
      expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockResolvedValueOnce(
        problemResponse("NO_SEATS_AVAILABLE", "Student A's first request failed."),
      )
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockResolvedValueOnce(jsonResponse(holdForTest, 201))
      .mockResolvedValue(jsonResponse([availableClass]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    fireEvent.click(await screen.findByRole("button", { name: /apply for admission/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Student A's first request failed.");
    fireEvent.click(screen.getByRole("button", { name: /apply for admission/i }));
    expect(await screen.findByText("Seat temporarily reserved")).toBeInTheDocument();
    expect(screen.queryByText(holdForTest.holdId)).not.toBeInTheDocument();
    expect(
      screen.getByTitle("The server remains authoritative for reservation expiry"),
    ).toHaveTextContent(/^\d{2}:\d{2}$/);

    fireEvent.change(screen.getByLabelText("Birth Registration Number"), {
      target: { value: "20152691234560050" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));

    expect(screen.queryByText("Seat temporarily reserved")).not.toBeInTheDocument();
    expect(screen.queryByText(holdForTest.holdId)).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("The server remains authoritative for reservation expiry"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not display a late hold response after switching identities", async () => {
    let resolveHold: ((response: Response) => void) | undefined;
    const pendingHold = new Promise<Response>((resolve) => {
      resolveHold = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([availableClass]))
      .mockReturnValueOnce(pendingHold)
      .mockResolvedValue(jsonResponse([availableClass]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <StudentClassesPage />
      </MemoryRouter>,
      { studentId: "20152691234560049" },
    );

    fireEvent.click(await screen.findByRole("button", { name: /apply for admission/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Birth Registration Number"), {
      target: { value: "20152691234560050" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    resolveHold?.(jsonResponse(createdHold, 201));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Seat temporarily reserved")).not.toBeInTheDocument();
    expect(screen.queryByText(createdHold.holdId)).not.toBeInTheDocument();
  });
});
