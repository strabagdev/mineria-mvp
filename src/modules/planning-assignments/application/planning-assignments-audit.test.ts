import { describe, expect, it } from "vitest";
import type { PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { havePlanningAssignmentsChanged } from "./planning-assignments-audit";

function assignment(overrides: Partial<PlanningAssignmentDto> = {}): PlanningAssignmentDto {
  return {
    id: 1,
    planning_item_id: 10,
    assignment_type_id: 1,
    instance_order: 1,
    values: [
      {
        id: 1,
        assignment_id: 1,
        field_id: 1,
        option_id: 2,
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: {},
      },
    ],
    ...overrides,
  };
}

describe("planning assignments audit comparison", () => {
  it("does not mark empty assignments as changed", () => {
    expect(havePlanningAssignmentsChanged([], [])).toBe(false);
  });

  it("ignores technical row ids when assignment content is unchanged", () => {
    const before = assignment();
    const after = assignment({
      id: 99,
      values: [{ ...before.values[0], id: 88, assignment_id: 99 }],
    });

    expect(havePlanningAssignmentsChanged([before], [after])).toBe(false);
  });

  it("marks added assignments as changed", () => {
    expect(havePlanningAssignmentsChanged([], [assignment()])).toBe(true);
  });

  it("marks removed assignments as changed", () => {
    expect(havePlanningAssignmentsChanged([assignment()], [])).toBe(true);
  });

  it("marks modified assignment values as changed", () => {
    const before = assignment({ values: [{ ...assignment().values[0], value_number: 4, option_id: null }] });
    const after = assignment({ values: [{ ...assignment().values[0], value_number: 8, option_id: null }] });

    expect(havePlanningAssignmentsChanged([before], [after])).toBe(true);
  });
});
