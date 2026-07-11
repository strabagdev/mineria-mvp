import { describe, expect, it } from "vitest";
import {
  resolveOperationalHeaderDynamicFormFields,
  shouldValidateOperationalHeaderRequiredField,
} from "./operational-header-form-dependencies";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";

const config: OperationalHeaderResponseDto = {
  fields: [
    {
      id: 1,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 10,
      grouping_order: null,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [
        { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
        { id: 11, field_id: 1, value: "nnm", label: "NNM", active: true, sort_order: 20, metadata: {} },
      ],
    },
    {
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 20,
      grouping_order: null,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [
        { id: 20, field_id: 2, value: "gt3", label: "GT3 N XC 2AS", active: true, sort_order: 10, metadata: {} },
        { id: 21, field_id: 2, value: "gt4", label: "GT4", active: true, sort_order: 20, metadata: {} },
        { id: 22, field_id: 2, value: "gt5", label: "GT5", active: true, sort_order: 30, metadata: {} },
      ],
    },
  ],
  dependencies: [
    {
      id: 100,
      field_id: 2,
      option_id: 20,
      depends_on_field_id: 1,
      depends_on_option_id: 11,
    },
  ],
};

describe("operational header form dependencies", () => {
  it("returns no fields when operational header config is missing", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: null,
      dynamicValues: {},
    });

    expect(resolved).toEqual([]);
  });

  it("applies dependencies from operational header field values", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config,
      dynamicValues: { 1: "NNM" },
    });
    const frente = resolved.find(({ field }) => field.slug === "frente");

    expect(frente?.options.map((option) => option.label)).toEqual(["GT3 N XC 2AS"]);
  });

  it("returns no front options when a dependent field has no selected parent option", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config,
      dynamicValues: {},
    });
    const frente = resolved.find(({ field }) => field.slug === "frente");

    expect(frente?.options).toEqual([]);
  });

  it("renders all active fields ordered by sort_order, including Nivel and Frente", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: {
        ...config,
        fields: [
          ...config.fields,
          {
            id: 3,
            slug: "area",
            label: "Area",
            input_type: "text",
            required: false,
            active: true,
            sort_order: 40,
            grouping_order: null,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [],
          },
          {
            id: 4,
            slug: "departamento",
            label: "Departamento",
            input_type: "select",
            required: true,
            active: true,
            sort_order: 30,
            grouping_order: null,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [
              { id: 40, field_id: 4, value: "mina", label: "Mina", active: true, sort_order: 20, metadata: {} },
              { id: 41, field_id: 4, value: "mantencion", label: "Mantencion", active: true, sort_order: 10, metadata: {} },
            ],
          },
        ],
      },
      dynamicValues: {},
    });

    expect(resolved.map(({ field }) => field.label)).toEqual(["Nivel", "Frente", "Departamento", "Area"]);
    expect(resolved[2]?.options.map((option) => option.label)).toEqual(["Mantencion", "Mina"]);
  });

  it("keeps form field order based on sort_order, not grouping_order", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: {
        dependencies: [],
        fields: [
          {
            ...config.fields[0],
            sort_order: 20,
            grouping_order: 1,
          },
          {
            ...config.fields[1],
            sort_order: 10,
            grouping_order: 99,
          },
        ],
      },
      dynamicValues: {},
    });

    expect(resolved.map(({ field }) => field.slug)).toEqual(["frente", "nivel"]);
  });

  it("applies dependencies to dynamic select fields using header values only", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: {
        ...config,
        fields: [
          ...config.fields,
          {
            id: 4,
            slug: "departamento",
            label: "Departamento",
            input_type: "select",
            required: true,
            active: true,
            sort_order: 30,
            grouping_order: null,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [
              { id: 40, field_id: 4, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
              { id: 41, field_id: 4, value: "mantencion", label: "Mantencion", active: true, sort_order: 20, metadata: {} },
              { id: 42, field_id: 4, value: "geologia", label: "Geologia", active: true, sort_order: 30, metadata: {} },
            ],
          },
        ],
        dependencies: [
          ...config.dependencies,
          {
            id: 200,
            field_id: 4,
            option_id: 40,
            depends_on_field_id: 1,
            depends_on_option_id: 10,
          },
        ],
      },
      dynamicValues: { 1: "NTI" },
    });

    const departamento = resolved.find(({ field }) => field.label === "Departamento");

    expect(departamento?.options.map((option) => option.label)).toEqual(["Mina"]);
  });

  it("returns no dynamic options when parent selections are missing", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: {
        ...config,
        fields: [
          ...config.fields,
          {
            id: 4,
            slug: "departamento",
            label: "Departamento",
            input_type: "select",
            required: true,
            active: true,
            sort_order: 30,
            grouping_order: null,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [
              { id: 40, field_id: 4, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
            ],
          },
        ],
        dependencies: [
          ...config.dependencies,
          {
            id: 200,
            field_id: 4,
            option_id: 40,
            depends_on_field_id: 1,
            depends_on_option_id: 10,
          },
        ],
      },
      dynamicValues: {},
    });

    const departamento = resolved.find(({ field }) => field.label === "Departamento");

    expect(departamento?.options).toEqual([]);
  });

  it("does not apply required validation while a dependent field is waiting for its parent", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config,
      dynamicValues: {},
    });
    const frente = resolved.find(({ field }) => field.slug === "frente");

    expect(frente?.captureState.unavailableReason).toBe("missing_parent");
    expect(frente?.captureState.requiredApplies).toBe(false);
    expect(frente ? shouldValidateOperationalHeaderRequiredField(frente) : true).toBe(false);
  });

  it("marks required dependent selects as invalid when the selected parent has no child options", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config,
      dynamicValues: { 1: "NTI" },
    });
    const frente = resolved.find(({ field }) => field.slug === "frente");

    expect(frente?.options).toEqual([]);
    expect(frente?.captureState.unavailableReason).toBe("no_valid_options");
    expect(frente?.captureState.requiredApplies).toBe(true);
  });

  it("ignores inactive fields for capture and validation", () => {
    const resolved = resolveOperationalHeaderDynamicFormFields({
      config: {
        ...config,
        fields: [
          ...config.fields,
          {
            id: 5,
            slug: "sector",
            label: "Sector",
            input_type: "text",
            required: true,
            active: false,
            sort_order: 50,
            grouping_order: null,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [],
          },
        ],
      },
      dynamicValues: {},
    });

    expect(resolved.some(({ field }) => field.slug === "sector")).toBe(false);
  });
});
