import { describe, expect, it } from "vitest";

import {
  buildReportQuery,
  formatHours,
  formatReportDate,
  getInitialReportFilters,
  getOperationalHeaderBreakdownGroups,
  toDisplayCategory,
  toTrackingLabel,
} from "./reporting-helpers";

describe("reporting presentation helpers", () => {
  it("builds report queries with trimmed non-empty filters only", () => {
    expect(
      buildReportQuery({
        date_from: " 2026-05-01 ",
        date_to: "2026-05-07",
        shift: "",
        category: "actividad",
        tracking_type: "",
        item_type: " Perforacion ",
        operational_header_filters: {},
      })
    ).toBe("date_from=2026-05-01&date_to=2026-05-07&category=actividad&item_type=Perforacion");
  });

  it("builds dynamic operational header filter query params", () => {
    expect(
      buildReportQuery({
        date_from: "2026-05-01",
        date_to: "2026-05-07",
        shift: "",
        category: "",
        tracking_type: "",
        item_type: "",
        operational_header_filters: {
          nivel: "NNM",
          departamento: " Mineria ",
          especialidad: "",
        },
      })
    ).toBe("date_from=2026-05-01&date_to=2026-05-07&header_nivel=NNM&header_departamento=Mineria");
  });

  it("reads dynamic operational header filters from URL params", () => {
    const filters = getInitialReportFilters(
      new URLSearchParams("header_nivel=NTI&header_frente=Frente+2&header_departamento=Mineria&header_especialidad=Perforacion")
    );

    expect(filters.operational_header_filters).toEqual({
      nivel: "NTI",
      frente: "Frente 2",
      departamento: "Mineria",
      especialidad: "Perforacion",
    });
  });

  it("formats report labels without changing DTO values", () => {
    expect(formatHours(12.25)).toBe("12,3");
    expect(formatReportDate("2026-05-07")).toBe("07-05-2026");
    expect(toDisplayCategory("actividad")).toBe("Actividad");
    expect(toDisplayCategory("interferencia")).toBe("Interferencia");
    expect(toTrackingLabel("programado")).toBe("Programado");
    expect(toTrackingLabel("real")).toBe("Real");
  });

  it("builds dynamic operational header breakdown groups with readable titles", () => {
    const groups = getOperationalHeaderBreakdownGroups(
      {
        dependencies: [],
        fields: [
          {
            id: 1,
            slug: "nivel",
            label: "Nivel",
            input_type: "select",
            required: true,
            active: true,
            sort_order: 10,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [],
          },
          {
            id: 2,
            slug: "frente",
            label: "Frente",
            input_type: "select",
            required: true,
            active: true,
            sort_order: 20,
            groupable: true,
            filterable: true,
            visible_in_gantt: true,
            exportable: true,
            options: [],
          },
          {
            id: 3,
            slug: "departamento",
            label: "Departamento",
            input_type: "select",
            required: false,
            active: true,
            sort_order: 30,
            groupable: true,
            filterable: true,
            visible_in_gantt: false,
            exportable: true,
            options: [],
          },
          {
            id: 4,
            slug: "especialidad",
            label: "Especialidad",
            input_type: "text",
            required: false,
            active: true,
            sort_order: 40,
            groupable: true,
            filterable: true,
            visible_in_gantt: false,
            exportable: true,
            options: [],
          },
        ],
      },
      [
        { id: 1, slug: "nivel", label: "Nivel", input_type: "select", sort_order: 10 },
        { id: 2, slug: "frente", label: "Frente", input_type: "select", sort_order: 20 },
        { id: 3, slug: "departamento", label: "Departamento", input_type: "select", sort_order: 30 },
        { id: 4, slug: "especialidad", label: "Especialidad", input_type: "text", sort_order: 40 },
      ],
      {
        nivel: [{ label: "NTI", count: 2, hours: 4 }],
        frente: [{ label: "Frente 2", count: 1, hours: 2 }],
        departamento: [{ label: "Mineria", count: 3, hours: 6 }],
        especialidad: [{ label: "Perforacion", count: 1, hours: 1 }],
      }
    );

    expect(groups.map((group) => group.title)).toEqual([
      "Por Nivel",
      "Por Frente",
      "Por Departamento",
      "Por Especialidad",
    ]);
  });

  it("does not build empty or non-groupable operational header breakdown groups", () => {
    const groups = getOperationalHeaderBreakdownGroups(
      {
        dependencies: [],
        fields: [
          {
            id: 3,
            slug: "departamento",
            label: "Departamento",
            input_type: "select",
            required: false,
            active: true,
            sort_order: 30,
            groupable: true,
            filterable: true,
            visible_in_gantt: false,
            exportable: true,
            options: [],
          },
          {
            id: 4,
            slug: "especialidad",
            label: "Especialidad",
            input_type: "text",
            required: false,
            active: true,
            sort_order: 40,
            groupable: false,
            filterable: true,
            visible_in_gantt: false,
            exportable: true,
            options: [],
          },
        ],
      },
      [
        { id: 3, slug: "departamento", label: "Departamento", input_type: "select", sort_order: 30 },
        { id: 4, slug: "especialidad", label: "Especialidad", input_type: "text", sort_order: 40 },
      ],
      {
        departamento: [],
        especialidad: [{ label: "Perforacion", count: 1, hours: 1 }],
      }
    );

    expect(groups).toEqual([]);
  });
});
