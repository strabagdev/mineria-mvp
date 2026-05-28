export class AuthNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthNetworkError";
  }
}

export function isAuthNetworkError(error: unknown) {
  return error instanceof AuthNetworkError;
}
