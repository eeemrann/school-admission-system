import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  jsonResponse,
  problemResponse,
  renderWithProviders,
} from "../../../test/renderWithProviders";
import { AdminDashboardPage } from "./AdminDashboardPage";

const classes = [
  {
    id: "c_11111111111111111111111111111111",
    name: "Class 6 - Morning Shift",
    totalSeats: 100,
    heldSeats: 10,
    confirmedSeats: 60,
    availableSeats: 30,
  },
  {
    id: "c_22222222222222222222222222222222",
    name: "Class 7 - Day Shift",
    totalSeats: 50,
    heldSeats: 5,
    confirmedSeats: 20,
    availableSeats: 25,
  },
];

describe("AdminDashboardPage", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8080"));

  it("derives dashboard metrics from the class API response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(classes)));
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Capacity snapshot" })).toBeInTheDocument();
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getAllByText("55").length).toBeGreaterThan(0);
    expect(screen.getAllByText("63%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Class 6 - Morning Shift").length).toBeGreaterThan(0);
  });

  it("shows a loading state", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard data");
  });

  it("shows an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No classes published")).toBeInTheDocument();
  });

  it("shows an API error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse("INTERNAL_ERROR", "Dashboard unavailable.", 500)),
    );
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard unavailable.");
  });

  it("refreshes dashboard data from the API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(classes))
      .mockResolvedValueOnce(
        jsonResponse([{ ...classes[0], totalSeats: 110, availableSeats: 40 }, classes[1]]),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Capacity snapshot" });
    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((await screen.findAllByText("160")).length).toBeGreaterThan(0);
  });

  it("retries a failed dashboard request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(problemResponse("INTERNAL_ERROR", "Try again.", 500))
      .mockResolvedValueOnce(jsonResponse(classes));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Capacity snapshot")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
