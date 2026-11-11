import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getAllByText("30")).toHaveLength(2);
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

  it("updates a class name without changing its capacity data", async () => {
    const renamedClass = { ...admissionClass, name: "Class 6 — Morning Shift" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(admissionClass))
      .mockResolvedValueOnce(jsonResponse(renamedClass))
      .mockResolvedValueOnce(jsonResponse(renamedClass));
    vi.stubGlobal("fetch", fetchMock);
    renderDetails();

    await screen.findByRole("heading", { level: 1, name: admissionClass.name });
    fireEvent.click(screen.getByRole("button", { name: /edit name/i }));
    const dialog = await screen.findByRole("dialog", { name: "Edit class details" });
    const nameInput = within(dialog).getByLabelText("Class name");
    fireEvent.change(nameInput, { target: { value: renamedClass.name } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      await screen.findByRole("heading", { level: 1, name: renamedClass.name }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`http://localhost:8080/classes/${admissionClass.id}`);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      name: renamedClass.name,
      totalSeats: admissionClass.totalSeats,
    });
  });
});
