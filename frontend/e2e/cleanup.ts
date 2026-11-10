import { runCommand } from "./commands";
import {
  listProcessGroupMembers,
  readProcessSnapshot,
  type ProcessSnapshot,
} from "./process-inspection";
import { isOwnedContainer, type E2eRuntimeState } from "./runtime";

const apiTerminationTimeoutMs = 10_000;
const apiKillTimeoutMs = 5_000;
const processPollIntervalMs = 100;

export interface ProcessTerminationTimeouts {
  gracefulMs: number;
  killMs: number;
}

export async function cleanupRun(state: E2eRuntimeState, repositoryRoot: string): Promise<void> {
  const errors: string[] = [];

  try {
    await stopApiProcess(state);
  } catch (error) {
    errors.push(`API cleanup failed: ${formatError(error)}`);
  }

  try {
    await stopOwnedContainer(state, repositoryRoot);
  } catch (error) {
    errors.push(`PostgreSQL cleanup failed: ${formatError(error)}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

export async function stopApiProcess(
  state: E2eRuntimeState,
  timeouts: ProcessTerminationTimeouts = {
    gracefulMs: apiTerminationTimeoutMs,
    killMs: apiKillTimeoutMs,
  },
): Promise<void> {
  if (!state.apiPid && !state.apiProcessGroupId) {
    return;
  }

  const processGroupId = await resolveProcessGroupId(state);
  let inspection = await inspectOwnedApiProcessGroup(state, processGroupId);
  if (inspection.liveMembers.length === 0) {
    return;
  }

  sendProcessGroupSignal(processGroupId, "SIGTERM");
  if (await waitForProcessGroupExit(state, processGroupId, timeouts.gracefulMs)) {
    return;
  }

  inspection = await inspectOwnedApiProcessGroup(state, processGroupId);
  if (inspection.liveMembers.length === 0) {
    return;
  }

  sendProcessGroupSignal(processGroupId, "SIGKILL");
  if (!(await waitForProcessGroupExit(state, processGroupId, timeouts.killMs))) {
    inspection = await inspectOwnedApiProcessGroup(state, processGroupId);
    if (inspection.liveMembers.length > 0) {
      throw new Error(
        `E2E API process group ${processGroupId} still has live members after SIGKILL: ${inspection.liveMembers
          .map((member) => member.pid)
          .join(", ")}.`,
      );
    }
  }
}

export async function stopOwnedContainer(
  state: E2eRuntimeState,
  repositoryRoot: string,
): Promise<void> {
  if (!state.containerStarted) {
    return;
  }
  if (!state.containerId) {
    throw new Error("The E2E container was marked started without an ID.");
  }

  const inspection = await inspectContainer(
    state.containerId,
    state.containerLabelKey,
    repositoryRoot,
  );
  if (!inspection) {
    return;
  }

  if (!isOwnedContainer(state, inspection)) {
    throw new Error(
      `Refusing to stop container ${state.containerId}: ID or ownership label did not match this E2E run.`,
    );
  }

  try {
    await runCommand(
      "docker",
      ["stop", "--time", "5", state.containerId],
      repositoryRoot,
      undefined,
      15_000,
    );
  } catch (error) {
    if (!isAlreadyGoneError(error)) {
      throw error;
    }
  }
}

async function inspectContainer(
  containerId: string,
  labelKey: string,
  repositoryRoot: string,
): Promise<{ id: string; ownershipLabel?: string } | undefined> {
  try {
    const result = await runCommand(
      "docker",
      ["inspect", "--format", `{{.Id}}\t{{index .Config.Labels "${labelKey}"}}`, containerId],
      repositoryRoot,
      undefined,
      15_000,
    );
    const [id, ownershipLabel] = result.stdout.trim().split(/\s+/, 2);
    return { id, ownershipLabel };
  } catch (error) {
    if (isAlreadyGoneError(error)) {
      return undefined;
    }
    throw error;
  }
}

async function resolveProcessGroupId(state: E2eRuntimeState): Promise<number> {
  if (state.apiProcessGroupId) {
    return state.apiProcessGroupId;
  }

  if (!state.apiPid) {
    throw new Error("E2E API process state does not contain a PID or process group ID.");
  }

  const snapshot = await readProcessSnapshot(state.apiPid);
  if (!snapshot) {
    return state.apiPid;
  }
  return snapshot.processGroupId;
}

interface ProcessGroupInspection {
  members: ProcessSnapshot[];
  liveMembers: ProcessSnapshot[];
}

async function inspectOwnedApiProcessGroup(
  state: E2eRuntimeState,
  processGroupId: number,
): Promise<ProcessGroupInspection> {
  const members = await listProcessGroupMembers(processGroupId);
  const liveMembers = members.filter((member) => member.state !== "Z");
  if (liveMembers.length === 0) {
    return { members, liveMembers };
  }

  const leader = members.find((member) => member.pid === state.apiPid);
  if (leader && leader.processGroupId !== processGroupId) {
    throw new Error(
      `Refusing to signal API PID ${leader.pid}: it no longer belongs to process group ${processGroupId}.`,
    );
  }

  if (leader && leader.state !== "Z" && !leader.commandLine.includes(state.apiProcessMarker)) {
    throw new Error(
      `Refusing to signal API PID ${leader.pid}: its command does not belong to this E2E run.`,
    );
  }

  if (!liveMembers.some((member) => member.e2eRunId === state.runId)) {
    throw new Error(
      `Refusing to signal API process group ${processGroupId}: no live member carries this E2E run marker.`,
    );
  }

  return { members, liveMembers };
}

function sendProcessGroupSignal(processGroupId: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (isMissingProcessError(error)) {
      return;
    }
    throw error;
  }
}

async function waitForProcessGroupExit(
  state: E2eRuntimeState,
  processGroupId: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inspection = await inspectOwnedApiProcessGroup(state, processGroupId);
    if (inspection.liveMembers.length === 0) {
      return true;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, processPollIntervalMs));
  }

  return (await inspectOwnedApiProcessGroup(state, processGroupId)).liveMembers.length === 0;
}

function isAlreadyGoneError(error: unknown): boolean {
  return /no such container|no such object|is not running/i.test(formatError(error));
}

function isMissingProcessError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ESRCH");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
