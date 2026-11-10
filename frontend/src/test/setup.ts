import "@testing-library/jest-dom/vitest";

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});
