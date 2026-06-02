import { describe, expect, it } from "vitest";
import {
  AuthNetworkError,
  isAuthNetworkError,
  isRetryableAuthProviderError,
} from "./authErrors";
import {
  NETWORK_ERROR_MESSAGE,
  getNetworkRequestErrorReason,
  isNetworkRequestError,
} from "./networkStatus";

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

  it("treats browser network changes as retryable operational failures", () => {
    const error = Object.assign(new TypeError("Failed to fetch"), {
      cause: { code: "net::ERR_NETWORK_CHANGED" },
    });

    expect(getNetworkRequestErrorReason(error)).toBe("network-changed");
    expect(isNetworkRequestError(error)).toBe(true);
  });

  it("recognizes the local offline guard message as an operational failure", () => {
    expect(getNetworkRequestErrorReason(new Error(NETWORK_ERROR_MESSAGE))).toBe(
      "network-request-error"
    );
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
