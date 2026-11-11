import type {
  ApplicationHistoryItem,
  ClassSummary,
  CreatedClass,
  CreatedHold,
  CreateClassRequest,
  HoldConfirmation,
  HoldDetails,
  ProblemDetails,
  UpdateClassRequest,
} from "../../types/api";
import { getApiBaseUrl } from "../config/env";

export interface ApiClientOptions {
  baseUrl?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  studentId?: string;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails,
  ) {
    super(problem.detail ?? problem.title ?? "The API request failed.");
    this.name = "ApiError";
  }

  public get code(): string | undefined {
    return this.problem.code;
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  public constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getApiBaseUrl()).replace(/\/+$/, "");
  }

  public listClasses(signal?: AbortSignal): Promise<ClassSummary[]> {
    return this.request<ClassSummary[]>("/classes", { signal });
  }

  public getClass(classId: string, signal?: AbortSignal): Promise<ClassSummary> {
    return this.request<ClassSummary>(`/classes/${encodeURIComponent(classId)}`, {
      signal,
    });
  }

  public createClass(request: CreateClassRequest, signal?: AbortSignal): Promise<CreatedClass> {
    return this.request<CreatedClass>("/classes", {
      method: "POST",
      body: request,
      signal,
    });
  }

  public updateClassName(
    classId: string,
    request: UpdateClassRequest,
    signal?: AbortSignal,
  ): Promise<ClassSummary> {
    return this.request<ClassSummary>(`/classes/${encodeURIComponent(classId)}`, {
      method: "PATCH",
      body: request,
      signal,
    });
  }

  public createHold(
    classId: string,
    studentId: string,
    signal?: AbortSignal,
  ): Promise<CreatedHold> {
    return this.request<CreatedHold>(`/classes/${encodeURIComponent(classId)}/holds`, {
      method: "POST",
      studentId,
      signal,
    });
  }

  public getHold(holdId: string, signal?: AbortSignal): Promise<HoldDetails> {
    return this.request<HoldDetails>(`/holds/${encodeURIComponent(holdId)}`, {
      signal,
    });
  }

  public confirmHold(
    holdId: string,
    studentId: string,
    signal?: AbortSignal,
  ): Promise<HoldConfirmation> {
    return this.request<HoldConfirmation>(`/holds/${encodeURIComponent(holdId)}/confirm`, {
      method: "POST",
      studentId,
      signal,
    });
  }

  public cancelHold(holdId: string, studentId: string, signal?: AbortSignal): Promise<void> {
    return this.request<void>(`/holds/${encodeURIComponent(holdId)}`, {
      method: "DELETE",
      studentId,
      signal,
    });
  }

  public listMyHolds(studentId: string, signal?: AbortSignal): Promise<ApplicationHistoryItem[]> {
    return this.request<ApplicationHistoryItem[]>("/me/holds", {
      studentId,
      signal,
    });
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options.studentId !== undefined) {
      headers.set("X-Student-Id", options.studentId);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await parseProblemDetails(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await parseResponseBody(response)) as T;
  }
}

let configuredClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  configuredClient ??= new ApiClient();
  return configuredClient;
}

export function resetApiClientForTests(): void {
  configuredClient = undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as unknown;
}

async function parseProblemDetails(response: Response): Promise<ProblemDetails> {
  const text = await response.text();

  if (!text) {
    return {
      status: response.status,
      title: response.statusText || "Request failed",
    };
  }

  try {
    return JSON.parse(text) as ProblemDetails;
  } catch {
    return {
      status: response.status,
      title: response.statusText || "Request failed",
      detail: text,
    };
  }
}
