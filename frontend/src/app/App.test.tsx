import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("application shell", () => {
  it("renders the landing page and navigates to the student portal", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /clearer path/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: /browse available classes/i })[0]);

    expect(
      await screen.findByRole("heading", { name: /find the right class for your next step/i }),
    ).toBeInTheDocument();
  });

  it("renders the not-found route", () => {
    window.history.pushState({}, "", "/does-not-exist");
    render(<App />);

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });
});
