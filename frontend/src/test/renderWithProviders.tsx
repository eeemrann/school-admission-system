import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { StudentIdentityProvider } from "../contexts/StudentIdentityContext";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  studentId?: string;
  studentName?: string;
}

export function renderWithProviders(
  element: ReactElement,
  { studentId, studentName = "Test Student", ...options }: RenderWithProvidersOptions = {},
) {
  if (studentId) {
    window.localStorage.setItem("school-admission.student-id", studentId);
    window.localStorage.setItem("school-admission.student-name", studentName);
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <StudentIdentityProvider>{element}</StudentIdentityProvider>
      </QueryClientProvider>,
      options,
    ),
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function problemResponse(code: string, detail: string, status = 409): Response {
  return new Response(JSON.stringify({ code, detail, status, title: detail }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}
