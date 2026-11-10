import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupRun } from "./cleanup";
import { readRuntimeStateFromPointer, removeRuntimeFilesIfOwned } from "./runtime";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(frontendRoot, "..");

export default async function globalTeardown(): Promise<void> {
  let runtime;
  try {
    runtime = await readRuntimeStateFromPointer();
  } catch (error) {
    throw new Error(
      `E2E teardown cannot safely continue without valid runtime state: ${formatError(error)}`,
      { cause: error },
    );
  }

  await cleanupRun(runtime, repositoryRoot);
  await removeRuntimeFilesIfOwned(runtime);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
