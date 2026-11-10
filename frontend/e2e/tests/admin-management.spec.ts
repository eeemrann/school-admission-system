import { expect, test } from "@playwright/test";
import { createClass, listClasses, uniqueValue } from "../support";

test.describe("administrator dashboard and class management", () => {
  test("renders dashboard metrics from the complete API class list", async ({ page, request }) => {
    await createClass(request, uniqueValue("E2E Dashboard Class"), 10);
    const classes = await listClasses(request);
    const totalCapacity = classes.reduce((sum, item) => sum + item.totalSeats, 0);
    const totalHeld = classes.reduce((sum, item) => sum + item.heldSeats, 0);
    const totalConfirmed = classes.reduce((sum, item) => sum + item.confirmedSeats, 0);
    const totalAvailable = classes.reduce((sum, item) => sum + item.availableSeats, 0);
    const utilization =
      totalCapacity === 0 ? 0 : Math.round(((totalHeld + totalConfirmed) / totalCapacity) * 100);

    await page.goto("/admin");
    const metrics = page.locator('section[aria-labelledby="dashboard-metrics-heading"]');
    await expect(metrics.getByText(String(classes.length), { exact: true })).toBeVisible();
    await expect(
      metrics
        .getByText("Total capacity", { exact: true })
        .locator("..")
        .getByText(String(totalCapacity), { exact: true }),
    ).toBeVisible();
    await expect(
      metrics
        .getByText("Held seats", { exact: true })
        .locator("..")
        .getByText(String(totalHeld), { exact: true }),
    ).toBeVisible();
    await expect(
      metrics
        .getByText("Confirmed seats", { exact: true })
        .locator("..")
        .getByText(String(totalConfirmed), { exact: true }),
    ).toBeVisible();
    await expect(
      metrics
        .getByText("Available seats", { exact: true })
        .locator("..")
        .getByText(String(totalAvailable), { exact: true }),
    ).toBeVisible();
    await expect(
      metrics
        .getByText("Capacity utilized", { exact: true })
        .locator("..")
        .getByText(`${utilization}%`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Administrator authentication is not implemented")).toBeVisible();
  });

  test("searches classes case-insensitively with trimmed whitespace and opens details", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Searchable Class");
    const admissionClass = await createClass(request, className, 25);
    await createClass(request, uniqueValue("E2E Other Class"), 30);

    await page.goto("/admin/classes");
    const search = page.getByLabel("Search classes by name");
    await search.fill(`  ${className.toUpperCase()}  `);
    await expect(page.getByText(className, { exact: true })).toBeVisible();
    await expect(page.getByText(/E2E Other Class/)).not.toBeVisible();

    await page.getByRole("link", { name: `View details for ${className}` }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/classes/${admissionClass.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: className })).toBeVisible();
    await expect(
      page.getByText("Total seats", { exact: true }).locator("..").getByText("25", { exact: true }),
    ).toBeVisible();
  });

  test("creates a class, validates input, and refreshes the listing", async ({ page, request }) => {
    const className = uniqueValue("E2E Created Class");
    await page.goto("/admin/classes");
    await page.getByRole("button", { name: /new class/i }).click();
    const dialog = page.getByRole("dialog", { name: "Create a class" });

    await dialog.getByLabel("Class name").fill("   ");
    await dialog.getByLabel("Total seats").fill("12");
    await dialog.getByRole("button", { name: "Create class" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Enter a class name");

    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: /new class/i }).click();
    const reopenedDialog = page.getByRole("dialog", { name: "Create a class" });
    await reopenedDialog.getByLabel("Class name").fill(`  ${className}  `);
    await reopenedDialog.getByLabel("Total seats").fill("0");
    await reopenedDialog.getByRole("button", { name: "Create class" }).click();
    expect(
      await reopenedDialog
        .getByLabel("Total seats")
        .evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow),
    ).toBe(true);
    await reopenedDialog.getByLabel("Total seats").fill("12");
    await reopenedDialog.getByRole("button", { name: "Create class" }).click();
    await expect(page.getByText("Class created and the class list was refreshed.")).toBeVisible();
    await expect(page.getByText(className, { exact: true })).toBeVisible();

    const classes = await listClasses(request);
    expect(classes.some((item) => item.name === className && item.totalSeats === 12)).toBe(true);
  });

  test("handles unknown and malformed class details and mobile navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/classes");
    const menuButton = page.getByRole("button", { name: "Open administrator navigation" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await page.goto("/admin/classes/not-a-valid-class-id");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.goto("/admin/classes/c_00000000000000000000000000000000");
    await expect(page.getByRole("alert")).toContainText("requested class was not found");
  });
});
