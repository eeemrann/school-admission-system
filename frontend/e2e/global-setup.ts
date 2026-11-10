import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { cleanupRun } from "./cleanup";
import { getProcessGroupId } from "./process-inspection";
import { runCommand, tryRunCommand } from "./commands";
import {
  createRuntimeState,
  e2eDatabaseName,
  e2eDatabasePassword,
  e2eDatabaseUser,
  getDatabaseConnectionString,
  markContainerStarted,
  removeRuntimeFilesIfOwned,
  writeRuntimeState,
  writeRuntimePointer,
} from "./runtime";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(frontendRoot, "..");
const e2eTempRoot = resolve(repositoryRoot, ".e2e-tmp");
const apiProject = resolve(
  repositoryRoot,
  "backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj",
);
const infrastructureProject = resolve(
  repositoryRoot,
  "backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj",
);

export default async function globalSetup(): Promise<void> {
  await mkdir(e2eTempRoot, { recursive: true });
  const apiPort = readPort("E2E_API_PORT", 5085);
  const frontendPort = readPort("E2E_FRONTEND_PORT", 5175);
  const databasePort = readPort("E2E_DB_PORT", 55433);
  let runtime = createRuntimeState({
    apiPort,
    apiLogPath: resolve(e2eTempRoot, `api-${process.pid}.log`),
    apiErrorLogPath: resolve(e2eTempRoot, `api-${process.pid}.error.log`),
    apiProcessMarker: apiProject,
    databasePort,
    frontendPort,
  });

  try {
    await assertPortAvailable(databasePort, "E2E PostgreSQL");
    await assertPortAvailable(apiPort, "E2E API");
    await writeRuntimeState(runtime);
    await writeRuntimePointer(runtime);

    const containerResult = await runCommand(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        runtime.containerName,
        "--label",
        `${runtime.containerLabelKey}=${runtime.containerLabelValue}`,
        "--env",
        `POSTGRES_DB=${e2eDatabaseName}`,
        "--env",
        `POSTGRES_USER=${e2eDatabaseUser}`,
        "--env",
        `POSTGRES_PASSWORD=${e2eDatabasePassword}`,
        "--publish",
        `127.0.0.1:${databasePort}:5432`,
        "postgres:18",
      ],
      repositoryRoot,
      undefined,
      60_000,
    );
    runtime = markContainerStarted(runtime, containerResult.stdout);
    await writeRuntimeState(runtime);

    await waitForPostgres(runtime.containerId as string);

    const dotnetEnvironment = getDotnetEnvironment(getDatabaseConnectionString(databasePort));
    await runCommand("dotnet", ["tool", "restore"], repositoryRoot, dotnetEnvironment, 180_000);
    await runCommand(
      "dotnet",
      [
        "ef",
        "database",
        "update",
        "--project",
        infrastructureProject,
        "--startup-project",
        apiProject,
        "--context",
        "SchoolAdmissionDbContext",
      ],
      repositoryRoot,
      dotnetEnvironment,
      180_000,
    );

    const apiProcess = startApi(
      apiPort,
      databasePort,
      runtime.runId,
      runtime.apiLogPath,
      runtime.apiErrorLogPath,
    );
    if (!apiProcess.pid) {
      throw new Error("The E2E API process did not expose a process ID.");
    }

    runtime = { ...runtime, apiPid: apiProcess.pid };
    const apiProcessGroupId = await waitForApiProcessGroupId(apiProcess.pid);
    runtime = { ...runtime, apiProcessGroupId };
    await writeRuntimeState(runtime);
    await waitForApi(apiPort);
  } catch (error) {
    try {
      await cleanupRun(runtime, repositoryRoot);
      await removeRuntimeFilesIfOwned(runtime);
    } catch (cleanupError) {
      throw new Error(
        `${formatError(error)}\nE2E setup cleanup also failed: ${formatError(cleanupError)}`,
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

function startApi(
  apiPort: number,
  databasePort: number,
  runId: string,
  apiLogPath: string,
  apiErrorLogPath: string,
): ChildProcess {
  const output = openSync(apiLogPath, "w");
  const errorOutput = openSync(apiErrorLogPath, "w");
  const apiProcess = spawn(
    "dotnet",
    ["run", "--project", apiProject, "--urls", `http://127.0.0.1:${apiPort}`],
    {
      cwd: repositoryRoot,
      detached: true,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: "Development",
        ConnectionStrings__DefaultConnection: getDatabaseConnectionString(databasePort),
        SCHOOL_ADMISSION_E2E_RUN_ID: runId,
        HOLD_DURATION_SECONDS: "15",
        HOLD_EXPIRY_BATCH_SIZE: "100",
        HOLD_EXPIRY_POLL_INTERVAL_SECONDS: "1",
      },
      stdio: ["ignore", output, errorOutput],
    },
  );

  apiProcess.once("close", () => {
    closeSync(output);
    closeSync(errorOutput);
  });
  return apiProcess;
}

async function waitForApiProcessGroupId(pid: number): Promise<number> {
  let lastError: unknown;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      return await getProcessGroupId(pid);
    } catch (error) {
      lastError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }

  throw new Error(`The E2E API process group could not be recorded: ${formatError(lastError)}`, {
    cause: lastError,
  });
}

function getDotnetEnvironment(connectionString: string): NodeJS.ProcessEnv {
  const dotnetHome = resolve(e2eTempRoot, "dotnet");
  const nugetPackages = resolve(e2eTempRoot, "nuget");
  return {
    ...process.env,
    ConnectionStrings__DefaultConnection: connectionString,
    DOTNET_CLI_HOME: dotnetHome,
    TEMP: e2eTempRoot,
    TMP: e2eTempRoot,
    TMPDIR: e2eTempRoot,
    NUGET_HTTP_CACHE_PATH: `${nugetPackages}-http`,
    NUGET_PACKAGES: nugetPackages,
  };
}

async function waitForPostgres(containerId: string): Promise<void> {
  await waitForCondition(
    async () => {
      const result = await tryRunCommand(
        "docker",
        [
          "exec",
          containerId,
          "pg_isready",
          "--dbname",
          e2eDatabaseName,
          "--username",
          e2eDatabaseUser,
        ],
        repositoryRoot,
        undefined,
        10_000,
      );
      return result.exitCode === 0;
    },
    "PostgreSQL readiness",
    60_000,
  );
}

async function waitForApi(apiPort: number): Promise<void> {
  await waitForCondition(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/health/ready`, {
          signal: AbortSignal.timeout(2_000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    "ASP.NET Core API readiness",
    120_000,
  );
}

async function waitForCondition(
  condition: () => Promise<boolean>,
  description: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`${description} did not become ready within ${timeoutMs}ms.`);
}

async function assertPortAvailable(port: number, description: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const server = net.createServer();
    server.once("error", () => {
      reject(new Error(`${description} port ${port} is already in use. Choose another E2E port.`));
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolvePromise());
    });
  });
}

function readPort(name: string, fallback: number): number {
  const value = process.env[name];
  const port = value ? Number(value) : fallback;
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1024 and 65535.`);
  }
  return port;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
