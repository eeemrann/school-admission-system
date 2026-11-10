import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("application shell", () => {
  it("renders the landing page and navigates to the student portal", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /calmer way/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /open student portal/i }));

    expect(
      await screen.findByRole("heading", { name: /find your next class/i }),
    ).toBeInTheDocument();
  });

  it("renders the not-found route", () => {
    window.history.pushState({}, "", "/does-not-exist");
    render(<App />);

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });
});
