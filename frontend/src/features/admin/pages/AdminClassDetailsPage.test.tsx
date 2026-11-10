import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  jsonResponse,
  problemResponse,
  renderWithProviders,
} from "../../../test/renderWithProviders";
import { AdminClassDetailsPage } from "./AdminClassDetailsPage";

const admissionClass = {
  id: "c_11111111111111111111111111111111",
  name: "Class 6 - Morning Shift",
  totalSeats: 100,
  heldSeats: 10,
  confirmedSeats: 60,
  availableSeats: 30,
};

function renderDetails() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/admin/classes/${admissionClass.id}`]}>
      <Routes>
        <Route element={<AdminClassDetailsPage />} path="/admin/classes/:classId" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminClassDetailsPage", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8080"));

  it("renders authoritative class details and utilization", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(admissionClass)));
    renderDetails();

    expect(
      await screen.findByRole("heading", { level: 1, name: admissionClass.name }),
    ).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getAllByText("70%").length).toBeGreaterThan(0);
  });

  it("shows the backend not-found error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse("CLASS_NOT_FOUND", "Class not found.", 404)),
    );
    renderDetails();

    expect(await screen.findByRole("alert")).toHaveTextContent("Class not found.");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
