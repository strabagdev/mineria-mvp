import { describe, expect, it } from "vitest";
import { ASSIGNMENT_TYPE_ICON_KEYS, isAssignmentFieldInputType, isAssignmentTypeIconKey } from "./planning-assignments";

describe("planning assignments contracts", () => {
  it("accepts only the simple assignment field input types", () => {
    expect(["text", "number", "date", "boolean", "select", "multi_select"].every(isAssignmentFieldInputType)).toBe(true);
    expect(isAssignmentFieldInputType("entity_reference")).toBe(false);
  });

  it("accepts only the closed assignment type icon catalog", () => {
    expect(ASSIGNMENT_TYPE_ICON_KEYS.every(isAssignmentTypeIconKey)).toBe(true);
    expect(isAssignmentTypeIconKey("sparkles")).toBe(false);
  });
});
