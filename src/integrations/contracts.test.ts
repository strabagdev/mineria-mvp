import { describe, expect, it } from "vitest";

import { buildIntegrationIdempotencyKey, isIntegrationSuccess, type IntegrationResult } from "./contracts";

describe("integration contracts", () => {
  it("builds stable idempotency keys from safe context parts", () => {
    expect(buildIntegrationIdempotencyKey([" Report ", "2026-05-24", "", null, "SHIFT-A", 42])).toBe(
      "report:2026-05-24:shift-a:42"
    );
  });

  it("narrows successful integration results", () => {
    const result: IntegrationResult<{ id: string }> = {
      ok: true,
      provider: "test-provider",
      value: { id: "delivery-1" },
    };

    expect(isIntegrationSuccess(result)).toBe(true);
    if (isIntegrationSuccess(result)) {
      expect(result.value.id).toBe("delivery-1");
    }
  });
});
