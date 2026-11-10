import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import type { Locator } from "@playwright/test";

export interface ApiClassSummary {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface ApiHold {
  holdId: string;
  classId: string;
  status: "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
}

export const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "5085"}`;

export function uniqueValue(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function createClass(
  request: APIRequestContext,
  name: string,
  totalSeats: number,
): Promise<{ id: string; name: string; totalSeats: number }> {
  const response = await request.post(`${apiBaseUrl}/classes`, {
    data: { name, totalSeats },
  });
  if (!response.ok()) {
    throw new Error(`Class setup failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as { id: string; name: string; totalSeats: number };
}

export async function listClasses(request: APIRequestContext): Promise<ApiClassSummary[]> {
  const response = await request.get(`${apiBaseUrl}/classes`);
  if (!response.ok()) {
    throw new Error(`Class listing failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as ApiClassSummary[];
}

export async function getClass(
  request: APIRequestContext,
  classId: string,
): Promise<ApiClassSummary> {
  const response = await request.get(`${apiBaseUrl}/classes/${encodeURIComponent(classId)}`);
  if (!response.ok()) {
    throw new Error(`Class detail failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as ApiClassSummary;
}

export async function createHold(
  request: APIRequestContext,
  classId: string,
  studentId: string,
): Promise<ApiHold> {
  const response = await request.post(
    `${apiBaseUrl}/classes/${encodeURIComponent(classId)}/holds`,
    { headers: { "X-Student-Id": studentId } },
  );
  if (!response.ok()) {
    throw new Error(`Hold setup failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as ApiHold;
}

export async function getHold(request: APIRequestContext, holdId: string): Promise<ApiHold> {
  const response = await request.get(`${apiBaseUrl}/holds/${encodeURIComponent(holdId)}`);
  if (!response.ok()) {
    throw new Error(`Hold lookup failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as ApiHold;
}

export async function selectStudent(page: Page, studentId: string): Promise<void> {
  const input = page.getByLabel("Birth Registration Number");
  await input.fill(studentId);
  await page.getByRole("button", { name: /use this number|change number/i }).click();
  await expectValue(input, studentId);
}

export async function expectValue(locator: Locator, value: string): Promise<void> {
  await locator.waitFor({ state: "visible" });
  if ((await locator.inputValue()) !== value) {
    throw new Error(`Expected input value ${value}, received ${await locator.inputValue()}.`);
  }
}
