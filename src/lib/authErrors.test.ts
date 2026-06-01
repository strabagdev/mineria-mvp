import { describe, expect, it } from "vitest";
import {
  AuthNetworkError,
  isAuthNetworkError,
  isRetryableAuthProviderError,
} from "./authErrors";
import { NETWORK_ERROR_MESSAGE, isNetworkRequestError } from "./networkStatus";

describe("auth network errors", () => {
  it("marks auth fetch failures as operational network errors", () => {
    const error = new AuthNetworkError(NETWORK_ERROR_MESSAGE);

    expect(isAuthNetworkError(error)).toBe(true);
    expect(isNetworkRequestError(error)).toBe(true);
  });

  it("does not classify regular auth errors as network failures", () => {
    expect(isAuthNetworkError(new Error("Invalid login credentials"))).toBe(false);
    expect(isNetworkRequestError(new Error("Invalid login credentials"))).toBe(false);
  });

  it("recognizes retryable provider failures for adapter normalization", () => {
    expect(
      isRetryableAuthProviderError({
        name: "AuthRetryableFetchError",
        status: 503,
      })
    ).toBe(true);
    expect(
      isRetryableAuthProviderError({
        name: "AuthApiError",
        status: 400,
      })
    ).toBe(false);
  });
});
