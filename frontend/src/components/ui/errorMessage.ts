import { ApiError } from "../../lib/api/client";
import { ApiConfigurationError } from "../../lib/config/env";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiConfigurationError) {
    return error.message;
  }

  if (error instanceof ApiError) {
    return (
      error.message || apiCodeMessages[error.code ?? ""] || "The request could not be completed."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Please try again, or contact the school office if the issue continues.";
}

const apiCodeMessages: Record<string, string> = {
  STUDENT_ID_REQUIRED: "Select a birth registration number before continuing.",
  CLASS_NOT_FOUND: "This class is no longer available.",
  HOLD_NOT_FOUND: "This application could not be found.",
  HOLD_OWNER_FORBIDDEN: "This application belongs to a different selected student.",
  NO_SEATS_AVAILABLE: "No seats are available now. Refresh the class list and try again.",
  DUPLICATE_ACTIVE_APPLICATION: "This student already has an active application for this class.",
  HOLD_EXPIRED: "This reservation has expired and can no longer be confirmed.",
  HOLD_CANCELLED: "This reservation has already been cancelled.",
  CONFIRMED_HOLD_CANNOT_CANCEL: "A confirmed admission cannot be cancelled.",
};
