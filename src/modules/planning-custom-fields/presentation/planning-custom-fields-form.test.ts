import { describe, expect, it } from "vitest";
import type { PlanningCustomFieldDto } from "../contracts/planning-custom-fields";
import {
  buildCustomFieldFormState,
  fieldAppliesTo,
  fieldHasFormValue,
  getCustomFieldDisplayEntries,
  toCustomFieldValueInputs,
  toDisplayCustomFieldValues,
} from "./planning-custom-fields-form-model";

function makeField(input: Partial<PlanningCustomFieldDto> & Pick<PlanningCustomFieldDto, "id" | "input_type">): PlanningCustomFieldDto {
  return {
    id: input.id,
    slug: `field-${input.id}`,
    label: `Field ${input.id}`,
    icon_key: input.icon_key ?? null,
    input_type: input.input_type,
    active: input.active ?? true,
    required: input.required ?? false,
    applies_to: input.applies_to ?? "planned",
    sort_order: input.sort_order ?? 100,
    config: input.config ?? {},
    options: input.options ?? [],
  };
}

describe("planning custom field form helpers", () => {
  it("round-trips select and multi-select values into form state", () => {
    const state = buildCustomFieldFormState([
      {
        id: 10,
        field_id: 1,
        planning_item_id: 100,
        execution_segment_id: null,
        activity_group_id: null,
        option_id: 4,
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
      {
        id: 11,
        field_id: 2,
        planning_item_id: 100,
        execution_segment_id: null,
        activity_group_id: null,
        option_id: 8,
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
      {
        id: 12,
        field_id: 2,
        planning_item_id: 100,
        execution_segment_id: null,
        activity_group_id: null,
        option_id: 9,
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
    ]);

    expect(state[1]?.optionId).toBe("4");
    expect(state[2]?.optionIds).toEqual(["8", "9"]);
  });

  it("serializes each supported input type without mixing values into planning core", () => {
    const fields = [
      makeField({ id: 1, input_type: "select" }),
      makeField({ id: 2, input_type: "multi_select" }),
      makeField({ id: 3, input_type: "number" }),
      makeField({ id: 4, input_type: "text" }),
      makeField({ id: 5, input_type: "date" }),
      makeField({ id: 6, input_type: "boolean" }),
    ];

    expect(toCustomFieldValueInputs(fields, {
      1: { optionId: "11" },
      2: { optionIds: ["21", "22"] },
      3: { valueNumber: "6" },
      4: { valueText: " Observacion " },
      5: { valueDate: "2026-05-26" },
      6: { valueBoolean: false },
    })).toEqual([
      { field_id: 1, option_id: 11 },
      { field_id: 2, option_ids: [21, 22] },
      { field_id: 3, value_number: 6 },
      { field_id: 4, value_text: "Observacion" },
      { field_id: 5, value_date: "2026-05-26" },
      { field_id: 6, value_boolean: false },
    ]);
  });

  it("only applies active planned fields to the planned programado form", () => {
    expect(fieldAppliesTo(makeField({ id: 1, input_type: "text", applies_to: "planned" }), "planned")).toBe(true);
    expect(fieldAppliesTo(makeField({ id: 2, input_type: "text", applies_to: "both" }), "planned")).toBe(true);
    expect(fieldAppliesTo(makeField({ id: 3, input_type: "text", applies_to: "actual" }), "planned")).toBe(false);
    expect(fieldAppliesTo(makeField({ id: 4, input_type: "text", active: false }), "planned")).toBe(false);
  });

  it("detects historical values so inactive fields can still be displayed", () => {
    expect(fieldHasFormValue(1, { 1: { optionId: "7" } })).toBe(true);
    expect(fieldHasFormValue(2, { 2: { valueBoolean: false } })).toBe(true);
    expect(fieldHasFormValue(3, { 3: { valueText: "" } })).toBe(false);
    expect(fieldHasFormValue(4, {})).toBe(false);
  });

  it("converts queued custom field inputs into display values for offline detail", () => {
    expect(toDisplayCustomFieldValues([
      { field_id: 1, option_id: 10 },
      { field_id: 2, option_ids: [21, 22] },
      { field_id: 3, value_number: 6 },
      { field_id: 4, value_text: "Apoyo" },
      { field_id: 5, value_date: "2026-05-30" },
      { field_id: 6, value_boolean: false },
    ], { planningItemId: -123 })).toMatchObject([
      { field_id: 1, planning_item_id: -123, option_id: 10 },
      { field_id: 2, planning_item_id: -123, option_id: 21 },
      { field_id: 2, planning_item_id: -123, option_id: 22 },
      { field_id: 3, planning_item_id: -123, value_number: 6 },
      { field_id: 4, planning_item_id: -123, value_text: "Apoyo" },
      { field_id: 5, planning_item_id: -123, value_date: "2026-05-30" },
      { field_id: 6, planning_item_id: -123, value_boolean: false },
    ]);
  });

  it("formats only custom fields with assigned values for compact displays", () => {
    const fields = [
      makeField({
        id: 1,
        input_type: "select",
        label: "Equipo",
        options: [{ id: 10, field_id: 1, value: "mixer", label: "Mixer", active: true, sort_order: 100, metadata: {} }],
      }),
      makeField({ id: 2, input_type: "number", label: "Personas" }),
      makeField({ id: 3, input_type: "text", label: "Observacion" }),
    ];

    expect(getCustomFieldDisplayEntries(fields, [
      {
        id: 1,
        field_id: 1,
        planning_item_id: 100,
        execution_segment_id: null,
        activity_group_id: null,
        option_id: 10,
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
      {
        id: 2,
        field_id: 2,
        planning_item_id: 100,
        execution_segment_id: null,
        activity_group_id: null,
        option_id: null,
        value_text: null,
        value_number: 6,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
    ])).toEqual([
      { field: fields[0], value: "Mixer" },
      { field: fields[1], value: "6" },
    ]);
  });
});
