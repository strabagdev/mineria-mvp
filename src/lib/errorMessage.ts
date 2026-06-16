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

export function getErrorStatus(error: unknown, fallback = 500) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;

  if (status && status >= 400 && status <= 599) {
    return status;
  }

  const message = getErrorMessage(error, "");
  if (/missing bearer token|invalid session/i.test(message)) {
    return 401;
  }

  if (
    /permisos de administrador|permisos operativos|solicitud aun no ha sido aprobada|solicitud fue rechazada|cuenta esta inactiva/i.test(
      message
    )
  ) {
    return 403;
  }

  return fallback;
}
