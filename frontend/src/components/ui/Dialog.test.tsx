import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { ConfirmationDialog } from "./Dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <ConfirmationDialog
        description="Review this action before continuing."
        open={open}
        title="Review action"
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

describe("Dialog", () => {
  it("traps keyboard focus, closes with Escape, and restores focus", () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Review action" });
    const closeButton = within(dialog).getByRole("button", { name: "Close dialog" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole("button", { name: "Confirm" });
    expect(closeButton).toHaveFocus();

    confirmButton.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
