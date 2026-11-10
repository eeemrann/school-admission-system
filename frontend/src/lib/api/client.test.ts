import { ApiClient } from "./client";
import { ApiConfigurationError, getApiBaseUrl } from "../config/env";

describe("typed API client", () => {
  it("handles successful JSON responses and sends the student header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "c_1",
            name: "Class 6",
            totalSeats: 10,
            heldSeats: 1,
            confirmedSeats: 2,
            availableSeats: 7,
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({ baseUrl: "http://localhost:8080/" });
    const classes = await client.listMyHolds("student-42");

    expect(classes).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/me/holds",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).get("X-Student-Id")).toBe("student-42");
  });

  it("parses RFC 7807 problem details into a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://example.invalid/problems/no-seats",
            title: "No seats available",
            status: 409,
            detail: "The class is full.",
            code: "NO_SEATS_AVAILABLE",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );

    await expect(
      new ApiClient({ baseUrl: "http://localhost:8080" }).listClasses(),
    ).rejects.toMatchObject({
      status: 409,
      code: "NO_SEATS_AVAILABLE",
      message: "The class is full.",
    });
  });

  it("reports missing or invalid API configuration clearly", () => {
    expect(() => getApiBaseUrl({})).toThrow(ApiConfigurationError);
    expect(() => getApiBaseUrl({ VITE_API_BASE_URL: "postgres://db" })).toThrow(
      ApiConfigurationError,
    );
  });

  it("accepts a same-origin API path for production reverse proxying", () => {
    expect(getApiBaseUrl({ VITE_API_BASE_URL: "/api/" })).toBe("/api");
    expect(() => getApiBaseUrl({ VITE_API_BASE_URL: "//api.internal" })).toThrow(
      ApiConfigurationError,
    );
  });
});
