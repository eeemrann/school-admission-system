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
      <button onClick={() => setStudentId("  20152691234560048  ")}>Set ID</button>
    </div>
  );
}

describe("student identity", () => {
  it("trims valid 17-digit identifiers and rejects invalid values", () => {
    expect(validateStudentId("  20152691234560048 ")).toEqual({
      ok: true,
      value: "20152691234560048",
    });
    expect(validateStudentId("   ").ok).toBe(false);
    expect(validateStudentId("2015269123456004").ok).toBe(false);
    expect(validateStudentId("2015269123456004A").ok).toBe(false);
  });

  it("persists a selected identifier for the next browser render", () => {
    const firstRender = renderIdentityProbe();

    fireEvent.click(screen.getByRole("button", { name: "Set ID" }));
    expect(screen.getByText("20152691234560048")).toBeInTheDocument();
    firstRender.unmount();

    renderIdentityProbe();

    expect(screen.getByText("20152691234560048")).toBeInTheDocument();
  });
});
