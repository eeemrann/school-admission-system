export interface E2eContainerOwnershipState {
  containerStarted: boolean;
  containerId?: string;
  containerLabelValue: string;
}

export interface E2eContainerInspection {
  id: string;
  ownershipLabel?: string;
}

export function isOwnedE2eContainer(
  state: E2eContainerOwnershipState,
  inspection: E2eContainerInspection,
): boolean {
  return (
    state.containerStarted === true &&
    typeof state.containerId === "string" &&
    inspection.id.toLowerCase() === state.containerId.toLowerCase() &&
    inspection.ownershipLabel === state.containerLabelValue
  );
}
