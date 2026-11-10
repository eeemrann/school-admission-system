import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StudentIdentityProvider } from "./StudentIdentityContext";
import { useStudentIdentity } from "../hooks/useStudentIdentity";
import { validateStudentId } from "./studentIdentity";
import { createQueryClient } from "../app/queryClient";

function renderIdentityProbe() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <StudentIdentityProvider>
        <IdentityProbe />
      </StudentIdentityProvider>
    </QueryClientProvider>,
  );
}

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
    const firstRender = renderIdentityProbe();

    fireEvent.click(screen.getByRole("button", { name: "Set ID" }));
    expect(screen.getByText("student-42")).toBeInTheDocument();
    firstRender.unmount();

    renderIdentityProbe();

    expect(screen.getByText("student-42")).toBeInTheDocument();
  });
});
