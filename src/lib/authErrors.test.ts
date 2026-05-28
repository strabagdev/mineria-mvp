import { describe, expect, it } from "vitest";
import { AuthNetworkError, isAuthNetworkError } from "./authErrors";
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
});
