import { ApiError } from "../../lib/api/client";
import { ApiConfigurationError } from "../../lib/config/env";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiConfigurationError) {
    return error.message;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Please try again, or contact the school office if the issue continues.";
}
