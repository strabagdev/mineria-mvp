import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOB_RETRY_POLICY,
  buildJobIdempotencyKey,
  createJobFailure,
  getJobRetryDelayMs,
  shouldRetryJobFailure,
} from "./contracts";

describe("job contracts", () => {
  it("builds stable idempotency keys for job executions", () => {
    expect(buildJobIdempotencyKey(" Scheduled Report ", ["2026-05-25", "", null, "Faena Norte", 7])).toBe(
      "scheduled report:2026-05-25:faena norte:7"
    );
  });

  it("calculates capped exponential retry delays", () => {
    expect(getJobRetryDelayMs(DEFAULT_JOB_RETRY_POLICY, 1)).toBe(30_000);
    expect(getJobRetryDelayMs(DEFAULT_JOB_RETRY_POLICY, 2)).toBe(60_000);
    expect(getJobRetryDelayMs(DEFAULT_JOB_RETRY_POLICY, 10)).toBe(900_000);
  });

  it("retries only retryable failures within max attempts", () => {
    const retryableFailure = createJobFailure({
      code: "PROVIDER_TIMEOUT",
      message: "Provider did not respond.",
      retryable: true,
    });
    const finalFailure = createJobFailure({
      code: "INVALID_INPUT",
      message: "Invalid payload.",
      retryable: false,
    });

    expect(shouldRetryJobFailure(retryableFailure, 1, DEFAULT_JOB_RETRY_POLICY)).toBe(true);
    expect(shouldRetryJobFailure(retryableFailure, 3, DEFAULT_JOB_RETRY_POLICY)).toBe(false);
    expect(shouldRetryJobFailure(finalFailure, 1, DEFAULT_JOB_RETRY_POLICY)).toBe(false);
  });
});
