import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { stopApiProcess } from "./cleanup";
import { getProcessGroupId, readProcessSnapshot } from "./process-inspection";
import type { E2eRuntimeState } from "./runtime";

test("terminates a surviving child after the process-group leader exits", async () => {
  const runId = randomUUID();
  // Keep markers on the repository filesystem. The system /tmp can have a
  // separate quota and fail writes with EDQUOT even when the workspace has space.
  const tempRoot = resolve(process.cwd(), "..", ".e2e-tmp");
  await mkdir(tempRoot, { recursive: true });
  const tempDirectory = await mkdtemp(join(tempRoot, `process-group-${runId}-`));
  const childPidFile = join(tempDirectory, "child.pid");
  const childReadyFile = `${childPidFile}.ready`;
  const childDiagnosticFile = `${childPidFile}.diagnostic`;
  const parentDiagnosticFile = `${childPidFile}.parent-diagnostic`;
  const marker = "process-group-cleanup-regression";
  const parentSource = [
    'const fs = require("node:fs");',
    'const { spawn } = require("node:child_process");',
    "const reportFailure = (phase, error) => { try { fs.writeFileSync(process.env.SCHOOL_ADMISSION_PARENT_DIAGNOSTIC_FILE, JSON.stringify({ phase, code: error && error.code, message: error && error.message, stack: error && error.stack })); } finally { process.exit(1); } };",
    'process.on("uncaughtException", (error) => reportFailure("uncaught-exception", error));',
    'process.on("unhandledRejection", (reason) => reportFailure("unhandled-rejection", reason instanceof Error ? reason : new Error(String(reason))));',
    'const child = spawn(process.execPath, ["-e", "const fs = require(\\"node:fs\\"); process.on(\\"SIGTERM\\", () => {}); fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_READY_FILE, \\"ready\\"); setInterval(() => {}, 1000);"], { env: process.env, stdio: "ignore" });',
    'child.on("error", (error) => fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_DIAGNOSTIC_FILE, JSON.stringify({ phase: "spawn-error", code: error.code, message: error.message })));',
    'child.on("exit", (code, signal) => { if (!fs.existsSync(process.env.SCHOOL_ADMISSION_CHILD_READY_FILE)) fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_DIAGNOSTIC_FILE, JSON.stringify({ phase: "child-exit", code, signal })); });',
    "fs.writeFileSync(process.env.SCHOOL_ADMISSION_CHILD_PID_FILE, String(child.pid));",
    'process.on("SIGTERM", () => process.exit(0));',
    "setInterval(() => {}, 1000);",
    `void "${marker}";`,
  ].join("\n");
  try {
    new Function(parentSource);
  } catch (error) {
    throw new Error(
      `Generated process-group parent script is invalid: ${formatProcessError(error)}`,
      {
        cause: error,
      },
    );
  }
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
        SCHOOL_ADMISSION_CHILD_DIAGNOSTIC_FILE: childDiagnosticFile,
        SCHOOL_ADMISSION_PARENT_DIAGNOSTIC_FILE: parentDiagnosticFile,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    if (!parent.pid) {
      throw new Error("The process-group regression parent did not expose a PID.");
    }
    let parentFailure: string | undefined;
    let parentStderr = "";
    let parentExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    parent.on("error", (error) => {
      parentFailure = `Parent spawn error: ${formatProcessError(error)}`;
    });
    parent.stderr?.on("data", (data: Buffer) => {
      parentStderr += data.toString();
    });
    parent.on("exit", (code, signal) => {
      parentExit = { code, signal };
    });
    parent.on("close", (code, signal) => {
      if (childPid === undefined && !parentFailure) {
        const diagnostic = parentStderr.trim();
        parentFailure = diagnostic
          ? `Parent exited before writing the child PID marker (code=${String(code)}, signal=${String(signal)}): ${diagnostic}`
          : `Parent exited before writing the child PID marker (code=${String(code)}, signal=${String(signal)}).`;
      }
    });
    const getParentFailure = (): string | undefined => {
      if (parentFailure) {
        return parentFailure;
      }
      const diagnostic = parentStderr.trim();
      if (parentExit && diagnostic) {
        return `Parent exited before writing the child PID marker (code=${String(parentExit.code)}, signal=${String(parentExit.signal)}): ${diagnostic}`;
      }
      return undefined;
    };

    processGroupId = await waitForProcessGroupId(parent.pid);
    childPid = Number(
      await waitForFile(childPidFile, getParentFailure, [
        childDiagnosticFile,
        parentDiagnosticFile,
      ]),
    );
    await waitForFile(childReadyFile, getParentFailure, [
      childDiagnosticFile,
      parentDiagnosticFile,
    ]);
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
    await unlink(childDiagnosticFile).catch(() => undefined);
    await unlink(parentDiagnosticFile).catch(() => undefined);
    await rm(tempDirectory, { recursive: true, force: true });
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

async function waitForFile(
  path: string,
  getParentFailure?: () => string | undefined,
  diagnosticPaths: string[] = [],
): Promise<string> {
  return waitFor(async () => {
    try {
      const value = await readFile(path, "utf8");
      if (value.trim()) {
        return value.trim();
      }
    } catch {
      // The marker may not exist yet; inspect diagnostics below.
    }
    for (const diagnosticPath of diagnosticPaths) {
      const diagnostic = await readOptionalFile(diagnosticPath);
      if (diagnostic) {
        throw new Error(`Process setup failed before marker ${path}: ${diagnostic}`);
      }
    }
    const parentFailure = getParentFailure?.();
    if (parentFailure) {
      throw new Error(parentFailure);
    }
    return undefined;
  }, 5_000);
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return (await readFile(path, "utf8")).trim() || undefined;
  } catch {
    return undefined;
  }
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

function formatProcessError(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    return `${error.message} (code=${String(error.code)})`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function hasLiveProcess(pid: number): Promise<boolean> {
  const snapshot = await readProcessSnapshot(pid);
  return snapshot !== undefined && snapshot.state !== "Z";
}
