import { expect, test } from "@playwright/test";
import {
  apiBaseUrl,
  createClass,
  getClass,
  getHold,
  selectStudent,
  uniqueStudentId,
  uniqueValue,
} from "../support";

test.describe("student admission workflow", () => {
  test("shows a loading state while the real class request is pending", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Loading Class");
    await createClass(request, className, 1);
    let releaseRequest: (() => void) | undefined;

    await page.route("**/api/classes", async (route) => {
      await new Promise<void>((resolve) => {
        releaseRequest = () => {
          void route.continue().then(() => resolve());
        };
      });
    });

    const navigation = page.goto("/student/classes");
    await expect(page.getByRole("status")).toContainText("Loading classes");
    releaseRequest?.();
    await navigation;
    await expect(page.getByText(className, { exact: true })).toBeVisible();
    await page.unroute("**/api/classes");
  });

  test("browses, reserves, confirms, and recovers the application after refresh", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Confirm Class");
    const studentId = uniqueStudentId();
    const admissionClass = await createClass(request, className, 2);

    await page.goto("/student/classes");
    await selectStudent(page, studentId);
    const classCard = page.getByRole("heading", { name: className }).locator("xpath=../../../..");
    await classCard.getByRole("button", { name: /apply for admission/i }).click();

    await expect(page.getByText("Seat temporarily reserved")).toBeVisible();
    const holdId = (await page.locator("code").first().textContent())?.trim();
    expect(holdId).toBeTruthy();
    await expect(
      page.getByTitle("The server remains authoritative for reservation expiry"),
    ).toContainText(/\d{2}:\d{2}/);

    await page.goto("/student/applications");
    await expect(page.getByText("HELD", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("HELD", { exact: true })).toBeVisible();
    await expect(page.getByText(holdId as string)).toBeVisible();

    await page.getByRole("button", { name: /pay admission fee/i }).click();
    const dialog = page.getByRole("dialog", { name: /pay admission fee/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /pay admission fee/i }).click();
    await expect(page.getByText("Admission confirmed.")).toBeVisible();
    await expect(page.getByText("CONFIRMED", { exact: true })).toBeVisible();

    const confirmedHold = await getHold(request, holdId as string);
    expect(confirmedHold.status).toBe("CONFIRMED");

    const repeatedConfirmation = await request.post(`${apiBaseUrl}/holds/${holdId}/confirm`, {
      headers: { "X-Student-Id": studentId },
    });
    expect(repeatedConfirmation.status()).toBe(200);
    expect((await repeatedConfirmation.json()).status).toBe("CONFIRMED");
    const classAfterRepeatedConfirmation = await getClass(request, admissionClass.id);
    expect(classAfterRepeatedConfirmation.heldSeats).toBe(0);
    expect(classAfterRepeatedConfirmation.confirmedSeats).toBe(1);
    expect(classAfterRepeatedConfirmation.availableSeats).toBe(1);
  });

  test("cancels a reservation and releases the seat", async ({ page, request }) => {
    const className = uniqueValue("E2E Cancel Class");
    const studentId = uniqueStudentId();
    const admissionClass = await createClass(request, className, 1);

    await page.goto("/student/classes");
    await selectStudent(page, studentId);
    const classCard = page.getByRole("heading", { name: className }).locator("xpath=../../../..");
    await classCard.getByRole("button", { name: /apply for admission/i }).click();
    await expect(page.getByText("Seat temporarily reserved")).toBeVisible();
    const holdId = (await page.locator("code").first().textContent())?.trim();
    expect(holdId).toBeTruthy();

    await page.goto("/student/applications");
    await page.getByRole("button", { name: /cancel reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /cancel reservation/i });
    await dialog.getByRole("button", { name: /cancel reservation/i }).click();
    await expect(page.getByText("Reservation cancelled.")).toBeVisible();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();

    const repeatedCancellation = await request.delete(`${apiBaseUrl}/holds/${holdId as string}`, {
      headers: { "X-Student-Id": studentId },
    });
    expect(repeatedCancellation.status()).toBe(204);
    expect((await getHold(request, holdId as string)).status).toBe("CANCELLED");

    await expect
      .poll(async () => (await getClass(request, admissionClass.id)).availableSeats)
      .toBe(1);
  });

  test("uses backend conflicts for duplicate and insufficient-seat applications", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Conflict Class");
    const studentA = uniqueStudentId();
    const studentB = uniqueStudentId();
    const admissionClass = await createClass(request, className, 2);

    await page.goto("/student/classes");
    await selectStudent(page, studentA);
    const classCard = page.getByRole("heading", { name: className }).locator("xpath=../../../..");
    await classCard.getByRole("button", { name: /apply for admission/i }).click();
    await expect(page.getByText("Seat temporarily reserved")).toBeVisible();

    await classCard.getByRole("button", { name: /apply for admission/i }).click();
    await expect(page.getByRole("alert")).toContainText("already has an active application");

    const secondHold = await request.post(`${apiBaseUrl}/classes/${admissionClass.id}/holds`, {
      headers: { "X-Student-Id": studentB },
    });
    expect(secondHold.status()).toBe(201);

    const noSeatResponse = await request.post(`${apiBaseUrl}/classes/${admissionClass.id}/holds`, {
      headers: { "X-Student-Id": uniqueStudentId() },
    });
    expect(noSeatResponse.status()).toBe(409);
    expect((await noSeatResponse.json()).code).toBe("NO_SEATS_AVAILABLE");
  });

  test("shows the no-seats conflict through two real browser sessions", async ({
    browser,
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Browser Full Class");
    const studentA = uniqueStudentId();
    const studentB = uniqueStudentId();
    const admissionClass = await createClass(request, className, 1);
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();

    try {
      await secondPage.goto("/student/classes");
      await selectStudent(secondPage, studentB);
      const secondClassCard = secondPage
        .getByRole("heading", { name: className })
        .locator("xpath=../../../..");
      await expect(
        secondClassCard.getByRole("button", { name: /apply for admission/i }),
      ).toBeVisible();

      await page.goto("/student/classes");
      await selectStudent(page, studentA);
      const firstClassCard = page
        .getByRole("heading", { name: className })
        .locator("xpath=../../../..");
      await firstClassCard.getByRole("button", { name: /apply for admission/i }).click();
      await expect(page.getByText("Seat temporarily reserved")).toBeVisible();

      await secondClassCard.getByRole("button", { name: /apply for admission/i }).click();
      await expect(secondPage.getByRole("alert")).toContainText("no available seats");
      await expect.poll(async () => (await getClass(request, admissionClass.id)).heldSeats).toBe(1);
      const finalClass = await getClass(request, admissionClass.id);
      expect(finalClass.confirmedSeats).toBe(0);
      expect(finalClass.availableSeats).toBe(0);
    } finally {
      await secondContext.close();
    }
  });

  test("keeps identity state isolated and verifies worker expiry without hold-read reconciliation", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Expiry Class");
    const studentA = uniqueStudentId();
    const studentB = uniqueStudentId();
    const admissionClass = await createClass(request, className, 1);

    await page.goto("/student/classes");
    await selectStudent(page, studentA);
    const classCard = page.getByRole("heading", { name: className }).locator("xpath=../../../..");
    await classCard.getByRole("button", { name: /apply for admission/i }).click();
    await expect(page.getByText("Seat temporarily reserved")).toBeVisible();
    const holdId = (await page.locator("code").first().textContent())?.trim();
    expect(holdId).toBeTruthy();

    await selectStudent(page, studentB);
    await expect(page.getByText("Seat temporarily reserved")).not.toBeVisible();
    await page.goto("/student/applications");
    await expect(page.getByText("No applications yet")).toBeVisible();
    await page.reload();
    await expect(page.getByText("No applications yet")).toBeVisible();

    await expect
      .poll(async () => (await getClass(request, admissionClass.id)).availableSeats, {
        timeout: 30_000,
        intervals: [250],
      })
      .toBe(1);
    const classAfterWorkerExpiry = await getClass(request, admissionClass.id);
    expect(classAfterWorkerExpiry.totalSeats).toBe(1);
    expect(classAfterWorkerExpiry.heldSeats).toBe(0);
    expect(classAfterWorkerExpiry.confirmedSeats).toBe(0);
    expect(classAfterWorkerExpiry.availableSeats).toBe(1);
    expect((await getHold(request, holdId as string)).status).toBe("EXPIRED");
    await selectStudent(page, studentA);
    await page.reload();
    await expect(page.getByText("EXPIRED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /pay admission fee/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /cancel reservation/i })).not.toBeVisible();
    await expect
      .poll(async () => (await getClass(request, admissionClass.id)).availableSeats)
      .toBe(1);
  });

  test("refreshes the authoritative hold state when the countdown reaches zero", async ({
    page,
    request,
  }) => {
    const className = uniqueValue("E2E Countdown Class");
    const studentId = uniqueStudentId();
    await createClass(request, className, 1);

    await page.goto("/student/classes");
    await selectStudent(page, studentId);
    const classCard = page.getByRole("heading", { name: className }).locator("xpath=../../../..");
    await classCard.getByRole("button", { name: /apply for admission/i }).click();
    await expect(page.getByText("Seat temporarily reserved")).toBeVisible();
    const holdId = (await page.locator("code").first().textContent())?.trim();
    expect(holdId).toBeTruthy();

    const countdown = page.getByTitle("The server remains authoritative for reservation expiry");
    await expect(countdown).toHaveText(/^\d{2}:\d{2}$/);
    const initialCountdown = await countdown.innerText();
    await expect
      .poll(async () => countdown.innerText(), { timeout: 5_000 })
      .not.toBe(initialCountdown);

    let releaseAuthoritativeResponse: (() => void) | undefined;
    const responseHeld = new Promise<void>((resolve) => {
      releaseAuthoritativeResponse = resolve;
    });
    await page.route(`**/api/holds/${holdId}`, async (route) => {
      const response = await route.fetch();
      await responseHeld;
      await route.fulfill({ response });
    });
    const authoritativeRequest = page.waitForRequest(
      (browserRequest) =>
        browserRequest.method() === "GET" && browserRequest.url().endsWith(`/api/holds/${holdId}`),
    );

    await expect
      .poll(async () => countdown.innerText(), { timeout: 30_000 })
      .toMatch(/Time reached|Checking status/);
    await authoritativeRequest;
    await expect(page.getByText("HELD", { exact: true })).toBeVisible();
    await expect(page.getByText("EXPIRED", { exact: true })).not.toBeVisible();

    releaseAuthoritativeResponse?.();
    await expect(page.getByText("EXPIRED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /pay admission fee/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /cancel reservation/i })).not.toBeVisible();
    await page.unroute(`**/api/holds/${holdId}`);
  });
});
