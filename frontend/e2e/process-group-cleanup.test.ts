import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { stopApiProcess } from "./cleanup";
import { getProcessGroupId, readProcessSnapshot } from "./process-inspection";
import type { E2eRuntimeState } from "./runtime";

test("terminates a surviving child after the process-group leader exits", async () => {
  const runId = randomUUID();
  const childPidFile = join(
    process.env.TMPDIR ?? "/tmp",
    `school-admission-process-group-test-${runId}.txt`,
  );
  const childReadyFile = `${childPidFile}.ready`;
  const marker = "process-group-cleanup-regression";
  const parentSource = [
    'const fs = require("node:fs");',
    'const { spawn } = require("node:child_process");',
    'const child = spawn(process.execPath, ["-e", "const fs = require(\\"node:fs\\"); process.on(\\"SIGTERM\\", () => {}); fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_READY_FILE, \\"ready\\"); setInterval(() => {}, 1000);"], { env: process.env, stdio: "ignore" });',
    "fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_PID_FILE, String(child.pid));",
    'process.on("SIGTERM", () => process.exit(0));',
    "setInterval(() => {}, 1000);",
    `void "${marker}";`,
  ].join("\n");
  let parent: ChildProcess | undefined;
  let processGroupId: number | undefined;
  let childPid: number | undefined;

  try {
    parent = spawn(process.execPath, ["-e", parentSource], {
      detached: true,
      env: {
        ...process.env,
        SCHOOL_ADMISSION_E2E_RUN_ID: runId,
        SCHOOL_ADMISSION_CHILD_PID_FILE: childPidFile,
        SCHOOL_ADMISSION_CHILD_READY_FILE: childReadyFile,
      },
      stdio: "ignore",
    });
    if (!parent.pid) {
      throw new Error("The process-group regression parent did not expose a PID.");
    }

    processGroupId = await waitForProcessGroupId(parent.pid);
    childPid = Number(await waitForFile(childPidFile));
    await waitForFile(childReadyFile);
    expect(childPid).toBeGreaterThan(0);

    process.kill(-processGroupId, "SIGTERM");
    await waitFor(
      async () => (parent && !(await hasLiveProcess(parent.pid as number)) ? true : undefined),
      5_000,
    );
    await waitFor(
      async () => ((await hasLiveProcess(childPid as number)) ? true : undefined),
      5_000,
    );

    const state: E2eRuntimeState = {
      version: 1,
      runId,
      apiPid: parent.pid,
      apiProcessGroupId: processGroupId,
      apiProcessMarker: marker,
      apiPort: 50_851,
      apiLogPath: "/tmp/process-group-test.log",
      apiErrorLogPath: "/tmp/process-group-test.error.log",
      containerName: `school-admission-e2e-db-${runId}`,
      containerStarted: false,
      containerLabelKey: "com.school-admission.e2e.run-id",
      containerLabelValue: runId,
      databasePort: 55_431,
      frontendPort: 51_751,
    };

    await stopApiProcess(state, { gracefulMs: 250, killMs: 2_000 });
    await waitFor(
      async () => (!(await hasLiveProcess(childPid as number)) ? true : undefined),
      5_000,
    );
    const childSnapshot = await readProcessSnapshot(childPid);
    if (childSnapshot) {
      expect(childSnapshot.state).toBe("Z");
    }
  } finally {
    if (processGroupId !== undefined) {
      try {
        process.kill(-processGroupId, "SIGKILL");
      } catch {
        // The dedicated test group may already have exited.
      }
    }
    if (parent?.pid && isLive(parent.pid)) {
      try {
        parent.kill("SIGKILL");
      } catch {
        // The dedicated test parent may already have exited.
      }
    }
    if (childPid && isLive(childPid)) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {
        // The dedicated test child may already have exited.
      }
    }
    await unlink(childPidFile).catch(() => undefined);
    await unlink(childReadyFile).catch(() => undefined);
  }
}, 30_000);

async function waitForProcessGroupId(pid: number): Promise<number> {
  let lastError: unknown;
  try {
    return await waitFor(async () => {
      try {
        return await getProcessGroupId(pid);
      } catch (error) {
        lastError = error;
        return undefined;
      }
    }, 5_000);
  } catch (error) {
    throw new Error(
      `Could not read the regression process group ID: ${String(lastError ?? error)}`,
      {
        cause: error,
      },
    );
  }
}

async function waitForFile(path: string): Promise<string> {
  return waitFor(async () => {
    try {
      const value = await readFile(path, "utf8");
      return value.trim() || undefined;
    } catch {
      return undefined;
    }
  }, 5_000);
}

async function waitFor<T>(condition: () => Promise<T | undefined>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await condition();
    if (result !== undefined && result !== false) {
      return result;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`Condition did not become true within ${timeoutMs}ms.`);
}

function isLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function hasLiveProcess(pid: number): Promise<boolean> {
  const snapshot = await readProcessSnapshot(pid);
  return snapshot !== undefined && snapshot.state !== "Z";
}
