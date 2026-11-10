import { readFile, readdir } from "node:fs/promises";

export interface ProcessSnapshot {
  pid: number;
  processGroupId: number;
  state: string;
  commandLine: string;
  e2eRunId?: string;
}

export async function getProcessGroupId(pid: number): Promise<number> {
  const snapshot = await readProcessSnapshot(pid);
  if (!snapshot) {
    throw new Error(`Process ${pid} no longer exists while reading its process group.`);
  }
  return snapshot.processGroupId;
}

export async function listProcessGroupMembers(processGroupId: number): Promise<ProcessSnapshot[]> {
  if (process.platform !== "linux") {
    throw new Error("E2E process-group inspection requires Linux /proc support.");
  }

  const entries = await readdir("/proc", { withFileTypes: true });
  const processIds = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name));
  const processStats = await Promise.all(processIds.map((pid) => readProcessStat(pid)));
  const groupStats = processStats.filter(
    (stat): stat is Omit<ProcessSnapshot, "commandLine" | "e2eRunId"> =>
      stat !== undefined && stat.processGroupId === processGroupId,
  );
  const snapshots = await Promise.all(groupStats.map((stat) => readProcessDetails(stat)));

  return snapshots.filter((snapshot): snapshot is ProcessSnapshot => snapshot !== undefined);
}

export async function readProcessSnapshot(pid: number): Promise<ProcessSnapshot | undefined> {
  if (process.platform !== "linux") {
    throw new Error("E2E process inspection requires Linux /proc support.");
  }

  const parsedStat = await readProcessStat(pid);
  if (!parsedStat) {
    return undefined;
  }
  return readProcessDetails(parsedStat);
}

async function readProcessStat(
  pid: number,
): Promise<Omit<ProcessSnapshot, "commandLine" | "e2eRunId"> | undefined> {
  let stat: string;
  try {
    stat = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (isMissingProcessError(error)) {
      return undefined;
    }
    throw error;
  }

  let parsedStat: Omit<ProcessSnapshot, "commandLine" | "e2eRunId">;
  try {
    parsedStat = parseProcessStat(stat, pid);
  } catch (error) {
    let retryStat: string;
    try {
      retryStat = await readFile(`/proc/${pid}/stat`, "utf8");
    } catch (retryError) {
      if (isMissingProcessError(retryError)) {
        return undefined;
      }
      throw error;
    }
    parsedStat = parseProcessStat(retryStat, pid);
  }
  return parsedStat;
}

async function readProcessDetails(
  parsedStat: Omit<ProcessSnapshot, "commandLine" | "e2eRunId">,
): Promise<ProcessSnapshot | undefined> {
  try {
    const [cmdline, environment] = await Promise.all([
      readFile(`/proc/${parsedStat.pid}/cmdline`, "utf8"),
      readFile(`/proc/${parsedStat.pid}/environ`, "utf8"),
    ]);
    return {
      ...parsedStat,
      commandLine: cmdline.replaceAll("\0", " ").trim(),
      e2eRunId: readEnvironmentValue(environment, "SCHOOL_ADMISSION_E2E_RUN_ID"),
    };
  } catch (error) {
    if (isMissingProcessError(error)) {
      return undefined;
    }
    throw new Error(`Could not inspect process ${parsedStat.pid}: ${formatError(error)}`, {
      cause: error,
    });
  }
}

function parseProcessStat(
  stat: string,
  pid: number,
): Omit<ProcessSnapshot, "commandLine" | "e2eRunId"> {
  const closingParenthesis = stat.lastIndexOf(")");
  if (closingParenthesis < 0) {
    throw new Error(`Could not parse /proc/${pid}/stat: missing command boundary.`);
  }

  const fields = stat
    .slice(closingParenthesis + 2)
    .trim()
    .split(/\s+/);
  const processState = fields[0];
  const processGroupId = Number(fields[2]);
  if (!processState || !Number.isInteger(processGroupId) || processGroupId < 0) {
    throw new Error(`Could not parse /proc/${pid}/stat: invalid process group metadata.`);
  }

  return { pid, processGroupId, state: processState };
}

function readEnvironmentValue(environment: string, key: string): string | undefined {
  const prefix = `${key}=`;
  return environment
    .split("\0")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

function isMissingProcessError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ESRCH"),
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
