import { describe, expect, it } from "vitest";
import type { AssignmentTypeDto, PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { applyAssignmentDerivations, buildPlanningAssignmentsFormState, getMetadataPathValue, getPlanningAssignmentSummaryEntries, getPlanningAssignmentTypeSummaries, toDisplayPlanningAssignments, toOperationalAssignmentTypes, toPlanningAssignmentInputs } from "./planning-assignments-form-model";

const type: AssignmentTypeDto = {
  id: 1, slug: "cuadrillas", label: "Cuadrillas", description: null, icon_key: "users", active: true, max_instances: 2, sort_order: 100, config: {},
  fields: [
    { id: 10, assignment_type_id: 1, slug: "codigo", label: "Codigo", input_type: "select", active: true, required: true, sort_order: 100, config: {}, options: [{ id: 20, field_id: 10, value: "cod-001", label: "COD-001", active: true, sort_order: 100, metadata: {} }] },
    { id: 11, assignment_type_id: 1, slug: "cantidad", label: "Cantidad", input_type: "number", active: true, required: false, sort_order: 200, config: {}, options: [] },
  ],
};

const assignment: PlanningAssignmentDto = {
  id: 100, planning_item_id: 200, execution_segment_id: null, assignment_type_id: 1, instance_order: 1,
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

  it("applies an optional trimmed visual suffix without inferring it from the slug", () => {
    const typeWithSuffix = {
      ...type,
      fields: type.fields.map((field) => field.id === 11 ? { ...field, config: { suffix: " pers. " } } : field),
    };
    expect(getPlanningAssignmentSummaryEntries([typeWithSuffix], [assignment])[0]?.values).toEqual([
      { field: typeWithSuffix.fields[0], value: "COD-001" },
      { field: typeWithSuffix.fields[1], value: "8 pers." },
    ]);
  });

  it("counts assignment instances by type for the Gantt popover", () => {
    expect(getPlanningAssignmentTypeSummaries([type], [assignment, { ...assignment, id: 101, instance_order: 2 }])).toEqual([{ type, count: 2 }]);
  });

  it("keeps only active operational definitions for the offline form", () => {
    expect(toOperationalAssignmentTypes([
      {
        ...type,
        fields: [
          ...type.fields,
          { ...type.fields[0], id: 12, slug: "inactivo", active: false },
          { ...type.fields[0], id: 13, slug: "opciones", options: [{ ...type.fields[0].options[0], active: false }] },
        ],
      },
      { ...type, id: 2, slug: "inactivo", active: false },
    ])).toEqual([
      {
        ...type,
        fields: [
          ...type.fields,
          { ...type.fields[0], id: 13, slug: "opciones", options: [] },
        ],
      },
    ]);
  });

  it("builds display assignments from queued lateral payloads", () => {
    expect(toDisplayPlanningAssignments([
      {
        assignment_type_id: 1,
        instance_order: 1,
        values: [
          { field_id: 10, option_id: 20 },
          { field_id: 11, value_number: 8 },
        ],
      },
    ], -9)).toMatchObject([
      {
        planning_item_id: -9,
        execution_segment_id: null,
        assignment_type_id: 1,
        instance_order: 1,
        values: [
          { field_id: 10, option_id: 20 },
          { field_id: 11, value_number: 8 },
        ],
      },
    ]);
  });

  it("reads simple metadata paths", () => {
    expect(getMetadataPathValue({ familia: "Camión" }, "metadata.familia")).toBe("Camión");
    expect(getMetadataPathValue({ familia: "Camión" }, "familia")).toBeUndefined();
    expect(getMetadataPathValue({ familia: "Camión" }, "metadata.")).toBeUndefined();
  });

  it("derives text fields from selected option metadata", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [
        {
          ...type.fields[0],
          config: { derives: { familia: "metadata.familia" } },
          options: [{ ...type.fields[0].options[0], metadata: { familia: "Camión" } }],
        },
        { ...type.fields[1], id: 11, slug: "familia", label: "Familia", input_type: "text" },
      ],
    };
    const instance = { instanceOrder: 1, values: { 10: { optionId: "20" } } };

    expect(applyAssignmentDerivations(
      typeWithDerivation,
      instance,
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[0]
    ).values[11]).toEqual({ valueText: "Camión" });
  });

  it("derives select fields by destination option value first", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [
        {
          ...type.fields[0],
          config: { derives: { familia: "metadata.familia" } },
          options: [{ ...type.fields[0].options[0], metadata: { familia: "camion" } }],
        },
        {
          ...type.fields[0],
          id: 11,
          slug: "familia",
          label: "Familia",
          input_type: "select",
          config: {},
          options: [
            { id: 30, field_id: 11, value: "camion", label: "Camión pesado", active: true, sort_order: 100, metadata: {} },
            { id: 31, field_id: 11, value: "otro", label: "camion", active: true, sort_order: 200, metadata: {} },
          ],
        },
      ],
    };

    expect(applyAssignmentDerivations(
      typeWithDerivation,
      { instanceOrder: 1, values: {} },
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[0]
    ).values[11]).toEqual({ optionId: "30" });
  });

  it("derives select fields by destination option label when value does not match", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [
        {
          ...type.fields[0],
          config: { derives: { familia: "metadata.familia" } },
          options: [{ ...type.fields[0].options[0], metadata: { familia: "Camión" } }],
        },
        {
          ...type.fields[0],
          id: 11,
          slug: "familia",
          label: "Familia",
          input_type: "select",
          config: {},
          options: [{ id: 30, field_id: 11, value: "camion", label: "Camión", active: true, sort_order: 100, metadata: {} }],
        },
      ],
    };

    expect(applyAssignmentDerivations(
      typeWithDerivation,
      { instanceOrder: 1, values: {} },
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[0]
    ).values[11]).toEqual({ optionId: "30" });
  });

  it("ignores missing destination fields and missing metadata paths", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [{ ...type.fields[0], config: { derives: { familia: "metadata.familia" } } }],
    };
    const instance = { instanceOrder: 1, values: {} };

    expect(applyAssignmentDerivations(typeWithDerivation, instance, typeWithDerivation.fields[0], typeWithDerivation.fields[0].options[0])).toEqual(instance);
  });

  it("keeps behavior unchanged when config has no derives", () => {
    const instance = { instanceOrder: 1, values: { 10: { optionId: "20" } } };

    expect(applyAssignmentDerivations(type, instance, type.fields[0], type.fields[0].options[0])).toEqual(instance);
  });

  it("does not write unsupported multi-select destinations", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [
        {
          ...type.fields[0],
          config: { derives: { familia: "metadata.familia" } },
          options: [{ ...type.fields[0].options[0], metadata: { familia: "Camión" } }],
        },
        { ...type.fields[0], id: 11, slug: "familia", label: "Familia", input_type: "multi_select", config: {} },
      ],
    };

    expect(applyAssignmentDerivations(
      typeWithDerivation,
      { instanceOrder: 1, values: {} },
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[0]
    ).values[11]).toBeUndefined();
  });

  it("updates derived values when the selected option changes", () => {
    const typeWithDerivation: AssignmentTypeDto = {
      ...type,
      fields: [
        {
          ...type.fields[0],
          config: { derives: { familia: "metadata.familia" } },
          options: [
            { ...type.fields[0].options[0], id: 20, metadata: { familia: "Camión" } },
            { ...type.fields[0].options[0], id: 21, value: "cod-002", label: "COD-002", metadata: { familia: "Jumbo" } },
          ],
        },
        { ...type.fields[1], id: 11, slug: "familia", label: "Familia", input_type: "text" },
      ],
    };
    const firstInstance = applyAssignmentDerivations(
      typeWithDerivation,
      { instanceOrder: 1, values: {} },
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[0]
    );

    expect(applyAssignmentDerivations(
      typeWithDerivation,
      firstInstance,
      typeWithDerivation.fields[0],
      typeWithDerivation.fields[0].options[1]
    ).values[11]).toEqual({ valueText: "Jumbo" });
  });
});
