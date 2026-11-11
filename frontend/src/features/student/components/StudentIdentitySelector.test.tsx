import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { StudentIdentitySelector } from "./StudentIdentitySelector";

describe("StudentIdentitySelector", () => {
  it("persists an optional display name and birth registration number", () => {
    renderWithProviders(<StudentIdentitySelector />);

    fireEvent.change(screen.getByLabelText("Student name (optional)"), {
      target: { value: "  Samira   Rahman " },
    });
    fireEvent.change(screen.getByLabelText("Birth Registration Number"), {
      target: { value: " 20152691234560048 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this number" }));

    expect(screen.getByText("Your student profile")).toBeInTheDocument();
    expect(screen.getByText("Identity selected")).toBeInTheDocument();
    expect(window.localStorage.getItem("school-admission.student-name")).toBe("Samira Rahman");
    expect(window.localStorage.getItem("school-admission.student-id")).toBe("20152691234560048");
  });

  it("allows selecting an identity with only the birth registration number", () => {
    renderWithProviders(<StudentIdentitySelector />);

    fireEvent.change(screen.getByLabelText("Birth Registration Number"), {
      target: { value: "20152691234560049" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this number" }));

    expect(screen.getByText("Your student profile")).toBeInTheDocument();
    expect(screen.getByText("Identity selected")).toBeInTheDocument();
    expect(window.localStorage.getItem("school-admission.student-name")).toBeNull();
    expect(window.localStorage.getItem("school-admission.student-id")).toBe("20152691234560049");
  });
});
