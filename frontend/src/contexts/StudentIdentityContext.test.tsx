import { fireEvent, render, screen } from "@testing-library/react";
import { StudentIdentityProvider } from "./StudentIdentityContext";
import { useStudentIdentity } from "../hooks/useStudentIdentity";
import { validateStudentId } from "./studentIdentity";

function IdentityProbe() {
  const { studentId, setStudentId } = useStudentIdentity();
  return (
    <div>
      <output>{studentId ?? "none"}</output>
      <button onClick={() => setStudentId("  student-42  ")}>Set ID</button>
    </div>
  );
}

describe("student identity", () => {
  it("trims valid identifiers and rejects blank values", () => {
    expect(validateStudentId("  student-42 ")).toEqual({ ok: true, value: "student-42" });
    expect(validateStudentId("   ").ok).toBe(false);
  });

  it("persists a selected identifier for the next browser render", () => {
    const firstRender = render(
      <StudentIdentityProvider>
        <IdentityProbe />
      </StudentIdentityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set ID" }));
    expect(screen.getByText("student-42")).toBeInTheDocument();
    firstRender.unmount();

    render(
      <StudentIdentityProvider>
        <IdentityProbe />
      </StudentIdentityProvider>,
    );

    expect(screen.getByText("student-42")).toBeInTheDocument();
  });
});
