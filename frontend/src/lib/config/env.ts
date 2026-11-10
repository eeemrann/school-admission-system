export interface FrontendEnvironment {
  VITE_API_BASE_URL?: string;
  [key: string]: string | undefined;
}

export class ApiConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

export function getApiBaseUrl(environment: FrontendEnvironment = import.meta.env): string {
  const configuredUrl = environment.VITE_API_BASE_URL?.trim();

  if (!configuredUrl) {
    throw new ApiConfigurationError(
      "The API is not configured. Set VITE_API_BASE_URL before starting the frontend.",
    );
  }

  if (configuredUrl.startsWith("/") && !configuredUrl.startsWith("//")) {
    return configuredUrl.replace(/\/+$/, "") || "/";
  }

  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new ApiConfigurationError(
      "VITE_API_BASE_URL must be a valid HTTP(S) URL or same-origin path.",
    );
  }

  return configuredUrl.replace(/\/+$/, "");
}
