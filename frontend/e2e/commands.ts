import { execFile } from "node:child_process";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 30_000,
): Promise<CommandResult> {
  const result = await tryRunCommand(command, args, cwd, env, timeoutMs);
  if (result.exitCode !== 0) {
    const timeout = result.timedOut ? ` (timed out after ${timeoutMs}ms)` : "";
    throw new Error(
      `${command} ${args.join(" ")} failed${timeout}:\n${result.stderr || result.stdout}`,
    );
  }
  return result;
}

export function tryRunCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 30_000,
): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    execFile(
      command,
      args,
      {
        cwd,
        env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
        killSignal: "SIGTERM",
      },
      (error, stdout, stderr) => {
        const timedOut = Boolean(error && "killed" in error && error.killed);
        resolvePromise({
          exitCode: error?.code && typeof error.code === "number" ? error.code : error ? 1 : 0,
          stdout: String(stdout),
          stderr: String(stderr),
          timedOut,
        });
      },
    );
  });
}
