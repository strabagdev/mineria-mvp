import { describe, expect, it } from "vitest";
import { isAssignmentFieldInputType } from "./planning-assignments";

describe("planning assignments contracts", () => {
  it("accepts only the simple assignment field input types", () => {
    expect(["text", "number", "date", "boolean", "select", "multi_select"].every(isAssignmentFieldInputType)).toBe(true);
    expect(isAssignmentFieldInputType("entity_reference")).toBe(false);
  });
});
