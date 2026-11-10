import "@testing-library/jest-dom/vitest";
import { resetApiClientForTests } from "../lib/api/client";

afterEach(() => {
  resetApiClientForTests();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});
