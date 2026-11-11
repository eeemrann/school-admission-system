import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  jsonResponse,
  problemResponse,
  renderWithProviders,
} from "../../../test/renderWithProviders";
import { AdminClassesPage } from "./AdminClassesPage";

const classes = [
  {
    id: "c_11111111111111111111111111111111",
    name: "Class 6 - Morning Shift",
    totalSeats: 40,
    heldSeats: 4,
    confirmedSeats: 20,
    availableSeats: 16,
  },
  {
    id: "c_22222222222222222222222222222222",
    name: "Class 7 - Day Shift",
    totalSeats: 30,
    heldSeats: 0,
    confirmedSeats: 15,
    availableSeats: 15,
  },
];

describe("AdminClassesPage", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8080"));

  it("lists real classes and filters by name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(classes)));
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Class 6 - Morning Shift")).toBeInTheDocument();
    expect(screen.getByText("Class 7 - Day Shift")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view details for class 6/i })).toHaveAttribute(
      "href",
      "/admin/classes/c_11111111111111111111111111111111",
    );

    fireEvent.change(screen.getByLabelText("Search classes by name"), {
      target: { value: "day" },
    });
    expect(screen.queryByText("Class 6 - Morning Shift")).not.toBeInTheDocument();
    expect(screen.getByText("Class 7 - Day Shift")).toBeInTheDocument();
  });

  it("filters the class register by availability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(classes)));
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Class 6 - Morning Shift");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter class availability" }), {
      target: { value: "full" },
    });

    expect(screen.queryByText("Class 6 - Morning Shift")).not.toBeInTheDocument();
    expect(screen.getByText("No matching classes")).toBeInTheDocument();
  });

  it("shows empty and API error states", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No classes yet")).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse("INTERNAL_ERROR", "Class list unavailable.", 500)),
    );
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Class list unavailable.");
  });

  it("validates creation, prevents repeated submission, and refreshes the list", async () => {
    let resolveCreate: ((response: Response) => void) | undefined;
    const pendingCreate = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(classes))
      .mockReturnValueOnce(pendingCreate)
      .mockResolvedValueOnce(
        jsonResponse([
          ...classes,
          { ...classes[0], id: "c_33333333333333333333333333333333", name: "Class 8" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Class 6 - Morning Shift");
    fireEvent.click(screen.getByRole("button", { name: /new class/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a class name.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Class 8" } });
    fireEvent.change(screen.getByLabelText("Total seats"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const createButton = screen.getByRole("button", { name: "Create class" });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveCreate?.(
      jsonResponse(
        { id: "c_33333333333333333333333333333333", name: "Class 8", totalSeats: 25 },
        201,
      ),
    );
    expect(
      await screen.findByText("Class created and the class list was refreshed."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Class 8")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:8080/classes");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      name: "Class 8",
      totalSeats: 25,
    });
  });

  it("surfaces backend validation errors from class creation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(classes))
      .mockResolvedValueOnce(
        problemResponse("VALIDATION_ERROR", "The class name is already invalid.", 400),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <AdminClassesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Class 6 - Morning Shift");
    fireEvent.click(screen.getByRole("button", { name: /new class/i }));
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Class 8" } });
    fireEvent.change(screen.getByLabelText("Total seats"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The class name is already invalid.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
