import { describe, expect, it } from "vitest";
import type { PlanningCustomFieldValueDto } from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import { havePlanningCustomFieldValuesChanged } from "./planning-custom-fields-audit";

function customFieldValue(overrides: Partial<PlanningCustomFieldValueDto> = {}): PlanningCustomFieldValueDto {
  return {
    id: 1,
    field_id: 1,
    planning_item_id: 10,
    execution_segment_id: null,
    activity_group_id: null,
    option_id: null,
    value_text: "Operaciones",
    value_number: null,
    value_date: null,
    value_boolean: null,
    value_json: {},
    ...overrides,
  };
}

describe("planning custom field values audit comparison", () => {
  it("does not mark empty custom field values as changed", () => {
    expect(havePlanningCustomFieldValuesChanged([], [])).toBe(false);
  });

  it("ignores technical row and target ids when value content is unchanged", () => {
    expect(havePlanningCustomFieldValuesChanged(
      [customFieldValue()],
      [customFieldValue({ id: 44, planning_item_id: 99 })]
    )).toBe(false);
  });

  it("marks added custom field values as changed", () => {
    expect(havePlanningCustomFieldValuesChanged([], [customFieldValue()])).toBe(true);
  });

  it("marks removed custom field values as changed", () => {
    expect(havePlanningCustomFieldValuesChanged([customFieldValue()], [])).toBe(true);
  });

  it("marks modified custom field values as changed", () => {
    expect(havePlanningCustomFieldValuesChanged(
      [customFieldValue({ value_text: "Operaciones" })],
      [customFieldValue({ value_text: "Mantencion" })]
    )).toBe(true);
  });
});
