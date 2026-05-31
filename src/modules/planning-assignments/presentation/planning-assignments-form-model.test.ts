import { describe, expect, it } from "vitest";
import type { AssignmentTypeDto, PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { buildPlanningAssignmentsFormState, getPlanningAssignmentSummaryEntries, toPlanningAssignmentInputs } from "./planning-assignments-form-model";

const type: AssignmentTypeDto = {
  id: 1, slug: "cuadrillas", label: "Cuadrillas", description: null, active: true, max_instances: 2, sort_order: 100, config: {},
  fields: [
    { id: 10, assignment_type_id: 1, slug: "codigo", label: "Codigo", input_type: "select", active: true, required: true, sort_order: 100, config: {}, options: [{ id: 20, field_id: 10, value: "cod-001", label: "COD-001", active: true, sort_order: 100, metadata: {} }] },
    { id: 11, assignment_type_id: 1, slug: "cantidad", label: "Cantidad", input_type: "number", active: true, required: false, sort_order: 200, config: {}, options: [] },
  ],
};

const assignment: PlanningAssignmentDto = {
  id: 100, planning_item_id: 200, assignment_type_id: 1, instance_order: 1,
  values: [
    { id: 1, assignment_id: 100, field_id: 10, option_id: 20, value_text: null, value_number: null, value_date: null, value_boolean: null, value_json: {} },
    { id: 2, assignment_id: 100, field_id: 11, option_id: null, value_text: null, value_number: 8, value_date: null, value_boolean: null, value_json: {} },
  ],
};

describe("planning assignments form model", () => {
  it("round-trips persisted assignments through form state", () => {
    expect(toPlanningAssignmentInputs([type], buildPlanningAssignmentsFormState([assignment]))).toEqual([{ assignment_type_id: 1, instance_order: 1, values: [{ field_id: 10, option_id: 20 }, { field_id: 11, value_number: 8 }] }]);
  });

  it("formats compact summary labels", () => {
    expect(getPlanningAssignmentSummaryEntries([type], [assignment])[0]?.values).toEqual([{ field: type.fields[0], value: "COD-001" }, { field: type.fields[1], value: "8" }]);
  });
});
