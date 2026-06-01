export class AuthNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthNetworkError";
  }
}

export function isAuthNetworkError(error: unknown) {
  return error instanceof AuthNetworkError;
}

export function isRetryableAuthProviderError(error: unknown) {
  if (isAuthNetworkError(error)) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const providerError = error as {
    name?: unknown;
    status?: unknown;
  };

  return (
    providerError.name === "AuthRetryableFetchError" ||
    providerError.status === 502 ||
    providerError.status === 503 ||
    providerError.status === 504
  );
}
