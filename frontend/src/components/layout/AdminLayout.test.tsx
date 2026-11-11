import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import { AdminLayout } from "./AdminLayout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin/classes"]}>
      <Routes>
        <Route element={<AdminLayout />} path="/admin">
          <Route element={<h1>Dashboard content</h1>} index />
          <Route element={<h1>Classes content</h1>} path="classes" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminLayout", () => {
  it("renders administrator navigation, breadcrumbs, and mobile menu controls", () => {
    renderLayout();

    expect(
      screen.getByRole("complementary", { name: "Administrator navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Classes" })).toHaveAttribute("href", "/admin/classes");
    expect(screen.getByRole("link", { name: "Student portal" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Classes content")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open administrator navigation" }));
    expect(screen.getAllByRole("button", { name: "Close administrator navigation" })).toHaveLength(
      2,
    );
    expect(screen.getByRole("button", { name: "Open administrator navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getAllByRole("button", { name: "Close administrator navigation" })[1],
    ).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open administrator navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Open administrator navigation" })).toHaveFocus();
  });

  it("removes closed mobile navigation links from the keyboard order", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        addEventListener: () => undefined,
        matches: false,
        media: "(min-width: 1024px)",
        removeEventListener: () => undefined,
      }),
    });

    const view = renderLayout();
    const dashboardLink = screen.getByRole("link", { hidden: true, name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("tabindex", "-1");

    view.unmount();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });
});
