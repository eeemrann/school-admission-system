import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOwnedE2eContainer, type E2eContainerInspection } from "../src/lib/e2eOwnership";

export const e2eDatabaseName = "school_admission_e2e";
export const e2eDatabaseUser = "school_admission_e2e";
export const e2eDatabasePassword = "e2e_only_not_a_secret";
export const e2eContainerLabelKey = "com.school-admission.e2e.run-id";
const runtimeStateVersion = 1;
const runtimePointerVersion = 1;

export interface E2eRuntimeState {
  version: 1;
  runId: string;
  apiPid?: number;
  apiProcessGroupId?: number;
  apiProcessMarker: string;
  apiPort: number;
  apiLogPath: string;
  apiErrorLogPath: string;
  containerName: string;
  containerId?: string;
  containerStarted: boolean;
  containerLabelKey: string;
  containerLabelValue: string;
  databasePort: number;
  frontendPort: number;
}

export interface CreateRuntimeStateOptions {
  apiPort: number;
  apiLogPath: string;
  apiErrorLogPath: string;
  apiProcessMarker: string;
  databasePort: number;
  frontendPort: number;
}

export type ContainerInspection = E2eContainerInspection;

interface E2eRuntimePointer {
  version: 1;
  runId: string;
  stateFile: string;
  apiPort: number;
  frontendPort: number;
}

export function createRuntimeState(options: CreateRuntimeStateOptions): E2eRuntimeState {
  const runId = randomUUID();

  return {
    version: runtimeStateVersion,
    runId,
    apiProcessMarker: options.apiProcessMarker,
    apiPort: options.apiPort,
    apiLogPath: options.apiLogPath,
    apiErrorLogPath: options.apiErrorLogPath,
    containerName: `school-admission-e2e-db-${runId}`,
    containerStarted: false,
    containerLabelKey: e2eContainerLabelKey,
    containerLabelValue: runId,
    databasePort: options.databasePort,
    frontendPort: options.frontendPort,
  };
}

export function markContainerStarted(state: E2eRuntimeState, containerId: string): E2eRuntimeState {
  const normalizedId = containerId.trim();
  if (!/^[a-f0-9]{12,64}$/i.test(normalizedId)) {
    throw new Error("Docker did not return a valid disposable E2E container ID.");
  }

  return {
    ...state,
    containerId: normalizedId,
    containerStarted: true,
  };
}

export function isOwnedContainer(state: E2eRuntimeState, inspection: ContainerInspection): boolean {
  return isOwnedE2eContainer(state, inspection);
}

export function getRuntimeFile(runId: string): string {
  if (!isRunId(runId)) {
    throw new Error("Cannot resolve an E2E runtime file for an invalid run ID.");
  }
  return join(tmpdir(), `school-admission-e2e-${runId}.json`);
}

export function getRuntimePointerFile(): string {
  const apiPort = process.env.E2E_API_PORT ?? "5085";
  const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5175";
  return join(tmpdir(), `school-admission-e2e-current-${apiPort}-${frontendPort}.json`);
}

export async function writeRuntimeState(state: E2eRuntimeState): Promise<void> {
  const runtimeFile = getRuntimeFile(state.runId);
  const temporaryFile = `${runtimeFile}.${state.runId}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryFile, JSON.stringify(state), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryFile, runtimeFile);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

export async function writeRuntimePointer(state: E2eRuntimeState): Promise<void> {
  const pointerFile = getRuntimePointerFile();
  await assertPointerAvailable(pointerFile, state);
  const pointer: E2eRuntimePointer = {
    version: runtimePointerVersion,
    runId: state.runId,
    stateFile: getRuntimeFile(state.runId),
    apiPort: state.apiPort,
    frontendPort: state.frontendPort,
  };
  const temporaryFile = `${pointerFile}.${state.runId}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryFile, JSON.stringify(pointer), { encoding: "utf8", flag: "wx" });
    await rename(temporaryFile, pointerFile);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

async function assertPointerAvailable(pointerFile: string, state: E2eRuntimeState): Promise<void> {
  try {
    const existing = validateRuntimePointer(
      JSON.parse(await readFile(pointerFile, "utf8")) as unknown,
    );
    if (existing.runId !== state.runId) {
      throw new Error(
        `E2E runtime pointer ${pointerFile} is already owned by run ${existing.runId}.`,
      );
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

export async function readRuntimeState(runId: string): Promise<E2eRuntimeState> {
  const runtimeFile = getRuntimeFile(runId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(runtimeFile, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`E2E runtime state could not be read: ${formatError(error)}`, { cause: error });
  }

  const state = validateRuntimeState(parsed);
  if (state.runId !== runId || runtimeFile !== getRuntimeFile(state.runId)) {
    throw new Error("E2E runtime state filename and run ID do not match.");
  }
  return state;
}

export async function readRuntimeStateFromPointer(): Promise<E2eRuntimeState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(getRuntimePointerFile(), "utf8")) as unknown;
  } catch (error) {
    throw new Error(`E2E runtime pointer could not be read: ${formatError(error)}`, {
      cause: error,
    });
  }

  const pointer = validateRuntimePointer(parsed);
  const state = await readRuntimeState(pointer.runId);
  if (
    pointer.stateFile !== getRuntimeFile(state.runId) ||
    pointer.apiPort !== state.apiPort ||
    pointer.frontendPort !== state.frontendPort
  ) {
    throw new Error("E2E runtime pointer does not match its runtime state.");
  }
  return state;
}

export async function removeRuntimeFilesIfOwned(state: E2eRuntimeState): Promise<void> {
  try {
    await unlink(getRuntimeFile(state.runId));
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  let pointer: E2eRuntimePointer;
  try {
    pointer = validateRuntimePointer(
      JSON.parse(await readFile(getRuntimePointerFile(), "utf8")) as unknown,
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw new Error(
      `E2E runtime pointer could not be validated for cleanup: ${formatError(error)}`,
      {
        cause: error,
      },
    );
  }

  if (
    pointer.runId !== state.runId ||
    pointer.stateFile !== getRuntimeFile(state.runId) ||
    pointer.apiPort !== state.apiPort ||
    pointer.frontendPort !== state.frontendPort
  ) {
    throw new Error("Refusing to remove a runtime pointer owned by another E2E run.");
  }
  await unlink(getRuntimePointerFile());
}

export function validateRuntimeState(value: unknown): E2eRuntimeState {
  if (!isRecord(value)) {
    throw new Error("E2E runtime state is not a JSON object.");
  }

  const state = value as Partial<E2eRuntimeState>;
  if (state.version !== runtimeStateVersion) {
    throw new Error("E2E runtime state has an unsupported version.");
  }

  const requiredStrings: Array<keyof E2eRuntimeState> = [
    "runId",
    "apiProcessMarker",
    "apiLogPath",
    "apiErrorLogPath",
    "containerName",
    "containerLabelKey",
    "containerLabelValue",
  ];
  for (const field of requiredStrings) {
    if (typeof state[field] !== "string" || state[field].length === 0) {
      throw new Error(`E2E runtime state field ${field} is invalid.`);
    }
  }

  if (
    !isPort(state.apiPort) ||
    !isPort(state.databasePort) ||
    !isPort(state.frontendPort) ||
    typeof state.containerStarted !== "boolean"
  ) {
    throw new Error("E2E runtime state contains invalid ports or container state.");
  }

  if (state.apiPid !== undefined && !isPositiveInteger(state.apiPid)) {
    throw new Error("E2E runtime state contains an invalid API process ID.");
  }

  if (state.apiProcessGroupId !== undefined && !isPositiveInteger(state.apiProcessGroupId)) {
    throw new Error("E2E runtime state contains an invalid API process group ID.");
  }

  if ((state.apiPid === undefined) !== (state.apiProcessGroupId === undefined)) {
    throw new Error("E2E runtime state must contain both API PID and process group ID together.");
  }

  if (!isRunId(state.runId)) {
    throw new Error("E2E runtime state contains an invalid run ID.");
  }

  if (state.containerId !== undefined && !/^[a-f0-9]{12,64}$/i.test(state.containerId)) {
    throw new Error("E2E runtime state contains an invalid Docker container ID.");
  }

  if (
    state.containerLabelKey !== e2eContainerLabelKey ||
    state.containerLabelValue !== state.runId ||
    state.containerName !== `school-admission-e2e-db-${state.runId}`
  ) {
    throw new Error("E2E runtime state container ownership metadata is inconsistent.");
  }

  if (state.containerStarted && !state.containerId) {
    throw new Error("E2E runtime state marks the container started without its ID.");
  }

  return state as E2eRuntimeState;
}

function validateRuntimePointer(value: unknown): E2eRuntimePointer {
  if (!isRecord(value) || value.version !== runtimePointerVersion) {
    throw new Error("E2E runtime pointer is invalid or has an unsupported version.");
  }
  if (
    typeof value.runId !== "string" ||
    !isRunId(value.runId) ||
    typeof value.stateFile !== "string" ||
    value.stateFile !== getRuntimeFile(value.runId) ||
    !isPort(value.apiPort) ||
    !isPort(value.frontendPort)
  ) {
    throw new Error("E2E runtime pointer contents are invalid.");
  }
  return value as unknown as E2eRuntimePointer;
}

export function getDatabaseConnectionString(databasePort: number): string {
  return `Host=127.0.0.1;Port=${databasePort};Database=${e2eDatabaseName};Username=${e2eDatabaseUser};Password=${e2eDatabasePassword}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPort(value: unknown): value is number {
  return isPositiveInteger(value) && value >= 1024 && value <= 65_535;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRunId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
