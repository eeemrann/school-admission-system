import { describe, expect, it } from "vitest";
import { createRuntimeState, markContainerStarted } from "../../e2e/runtime";
import { isOwnedE2eContainer } from "./e2eOwnership";

describe("E2E container ownership checks", () => {
  const state = {
    containerStarted: true,
    containerId: "abcdef1234567890",
    containerLabelValue: "run-a",
  };

  it("does not stop a colliding name before our container starts", () => {
    expect(
      isOwnedE2eContainer(
        { ...state, containerStarted: false },
        { id: state.containerId, ownershipLabel: state.containerLabelValue },
      ),
    ).toBe(false);
  });

  it("does not claim a container when Docker startup returns no container ID", () => {
    const runtime = createRuntimeState({
      apiPort: 5085,
      apiLogPath: "/tmp/e2e-api.log",
      apiErrorLogPath: "/tmp/e2e-api.error.log",
      apiProcessMarker: "SchoolAdmission.Api.csproj",
      databasePort: 55433,
      frontendPort: 5175,
    });

    expect(() => markContainerStarted(runtime, "Error response from daemon")).toThrow(
      "valid disposable E2E container ID",
    );
    expect(runtime.containerStarted).toBe(false);
    expect(runtime.containerId).toBeUndefined();
  });

  it("rejects a container with the wrong ID or ownership label", () => {
    expect(isOwnedE2eContainer(state, { id: "different-container", ownershipLabel: "run-a" })).toBe(
      false,
    );
    expect(isOwnedE2eContainer(state, { id: state.containerId, ownershipLabel: "run-b" })).toBe(
      false,
    );
  });

  it("accepts only the current run's inspected container", () => {
    expect(
      isOwnedE2eContainer(state, {
        id: state.containerId,
        ownershipLabel: state.containerLabelValue,
      }),
    ).toBe(true);
  });
});
