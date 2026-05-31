import { describe, expect, it } from "vitest";
import type { AssignmentFieldDto, AssignmentTypeDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  buildPlanningAssignmentsReplaceParams,
  normalizePlanningAssignments,
} from "./planning-assignment-values";

function makeField(input: Partial<AssignmentFieldDto> & Pick<AssignmentFieldDto, "id" | "input_type">): AssignmentFieldDto {
  return {
    id: input.id,
    assignment_type_id: input.assignment_type_id ?? 1,
    slug: input.slug ?? `field-${input.id}`,
    label: input.label ?? `Field ${input.id}`,
    input_type: input.input_type,
    active: input.active ?? true,
    required: input.required ?? false,
    sort_order: input.sort_order ?? 100,
    config: input.config ?? {},
    options: input.options ?? [],
  };
}

function makeType(fields: AssignmentFieldDto[], input: Partial<AssignmentTypeDto> = {}): AssignmentTypeDto {
  return {
    id: input.id ?? 1,
    slug: input.slug ?? "cuadrillas",
    label: input.label ?? "Cuadrillas",
    description: input.description ?? null,
    active: input.active ?? true,
    max_instances: input.max_instances ?? 2,
    sort_order: input.sort_order ?? 100,
    config: input.config ?? {},
    fields,
  };
}

describe("planning assignment value normalization", () => {
  it("normalizes scalar and option values without mixing their storage columns", () => {
    const type = makeType([
      makeField({
        id: 10,
        input_type: "select",
        options: [{ id: 20, field_id: 10, value: "cod-001", label: "COD-001", active: true, sort_order: 100, metadata: {} }],
      }),
      makeField({ id: 11, input_type: "number" }),
      makeField({ id: 12, input_type: "text" }),
      makeField({ id: 13, input_type: "date" }),
      makeField({ id: 14, input_type: "boolean" }),
    ]);

    expect(normalizePlanningAssignments([type], [{
      assignment_type_id: 1,
      instance_order: 1,
      values: [
        { field_id: 10, option_id: 20 },
        { field_id: 11, value_number: 8 },
        { field_id: 12, value_text: "  Fortificacion " },
        { field_id: 13, value_date: "2026-05-31" },
        { field_id: 14, value_boolean: false },
      ],
    }])).toEqual([{
      assignment_type_id: 1,
      instance_order: 1,
      values: [
        { field_id: 10, option_id: 20, value_json: {} },
        { field_id: 11, value_number: 8, value_json: {} },
        { field_id: 12, value_text: "Fortificacion", value_json: {} },
        { field_id: 13, value_date: "2026-05-31", value_json: {} },
        { field_id: 14, value_boolean: false, value_json: {} },
      ],
    }]);
  });

  it("rejects instances over the configured maximum", () => {
    expect(() => normalizePlanningAssignments([makeType([])], [{
      assignment_type_id: 1,
      instance_order: 3,
      values: [],
    }])).toThrow("debe estar entre 1 y 2");
  });

  it("stores one row per selected multi-select option", () => {
    const type = makeType([
      makeField({
        id: 10,
        input_type: "multi_select",
        options: [
          { id: 20, field_id: 10, value: "grupo-1", label: "Grupo 1", active: true, sort_order: 100, metadata: {} },
          { id: 21, field_id: 10, value: "grupo-2", label: "Grupo 2", active: true, sort_order: 200, metadata: {} },
        ],
      }),
    ]);

    expect(normalizePlanningAssignments([type], [{
      assignment_type_id: 1,
      instance_order: 1,
      values: [{ field_id: 10, option_ids: [20, 21, 20] }],
    }])[0]?.values).toEqual([
      { field_id: 10, option_id: 20, value_json: {} },
      { field_id: 10, option_id: 21, value_json: {} },
    ]);
  });

  it("rejects missing required values", () => {
    expect(() => normalizePlanningAssignments([makeType([
      makeField({ id: 10, input_type: "number", required: true }),
    ])], [{
      assignment_type_id: 1,
      instance_order: 1,
      values: [],
    }])).toThrow("Field 10 es obligatorio");
  });

  it("rejects fields from another assignment type", () => {
    expect(() => normalizePlanningAssignments([makeType([])], [{
      assignment_type_id: 1,
      instance_order: 1,
      values: [{ field_id: 99, value_text: "No corresponde" }],
    }])).toThrow("Un campo no pertenece al tipo Cuadrillas");
  });

  it("rejects options from another field", () => {
    expect(() => normalizePlanningAssignments([makeType([
      makeField({
        id: 10,
        input_type: "select",
        options: [{ id: 20, field_id: 10, value: "operaciones", label: "Operaciones", active: true, sort_order: 100, metadata: {} }],
      }),
    ])], [{
      assignment_type_id: 1,
      instance_order: 1,
      values: [{ field_id: 10, option_id: 99 }],
    }])).toThrow("La opcion seleccionada para Field 10 no es valida");
  });

  it("builds transactional replace params scoped to one planning item", () => {
    const assignments = [{ assignment_type_id: 1, instance_order: 1, values: [] }];
    expect(buildPlanningAssignmentsReplaceParams(123, assignments)).toEqual({
      p_planning_item_id: 123,
      p_assignments: assignments,
    });
  });
});
