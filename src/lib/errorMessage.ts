export function getErrorMessage(error: unknown, fallback = "Unknown error") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as { error?: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    typeof (error as { details?: unknown }).details === "string"
  ) {
    return (error as { details: string }).details;
  }

  return fallback;
}
