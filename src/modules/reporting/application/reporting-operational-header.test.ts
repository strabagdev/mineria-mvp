import { describe, expect, it } from "vitest";
import {
  getOperationalHeaderBreakdownFields,
  getOperationalHeaderExportableFields,
  getOperationalHeaderFilterableFields,
  sortOperationalHeaderReportFields,
  toOperationalHeaderReportColumn,
} from "./reporting-operational-header";
import type { OperationalHeaderFieldDto } from "@/modules/operational-header/contracts/operational-header";

function field(input: Partial<OperationalHeaderFieldDto> & Pick<OperationalHeaderFieldDto, "id" | "slug" | "label">): OperationalHeaderFieldDto {
  return {
    input_type: "text",
    required: false,
    active: true,
    sort_order: 100,
    grouping_order: null,
    groupable: true,
    filterable: true,
    visible_in_gantt: true,
    exportable: true,
    options: [],
    ...input,
  };
}

describe("reporting operational header semantics", () => {
  it("returns active exportable fields ordered by sort_order, label and id", () => {
    const fields = [
      field({ id: 3, slug: "c", label: "Beta", sort_order: 20 }),
      field({ id: 2, slug: "b", label: "Alpha", sort_order: 20 }),
      field({ id: 1, slug: "a", label: "Zeta", sort_order: 10, grouping_order: 999 }),
      field({ id: 4, slug: "inactive", label: "Inactive", active: false, exportable: true, sort_order: 5 }),
      field({ id: 5, slug: "hidden", label: "Hidden", exportable: false, sort_order: 5 }),
    ];
    const originalOrder = fields.map((candidate) => candidate.slug);

    expect(getOperationalHeaderExportableFields(fields).map((candidate) => candidate.slug)).toEqual(["a", "b", "c"]);
    expect(fields.map((candidate) => candidate.slug)).toEqual(originalOrder);
  });

  it("keeps filterable fields independent from exportable fields", () => {
    const filterOnly = field({ id: 1, slug: "guardia", label: "Guardia", exportable: false, filterable: true });
    const exportOnly = field({ id: 2, slug: "area", label: "Area", exportable: true, filterable: false });
    const inactive = field({ id: 3, slug: "sector", label: "Sector", active: false, exportable: true, filterable: true });

    expect(getOperationalHeaderFilterableFields([filterOnly, exportOnly, inactive]).map((candidate) => candidate.slug)).toEqual(["guardia"]);
    expect(getOperationalHeaderExportableFields([filterOnly, exportOnly, inactive]).map((candidate) => candidate.slug)).toEqual(["area"]);
  });

  it("returns breakdown fields only when active, groupable and exportable", () => {
    const breakdown = field({ id: 1, slug: "area", label: "Area", groupable: true, exportable: true });
    const filterOnly = field({ id: 2, slug: "guardia", label: "Guardia", groupable: true, exportable: false });
    const notGroupable = field({ id: 3, slug: "sector", label: "Sector", groupable: false, exportable: true });
    const inactive = field({ id: 4, slug: "turno", label: "Turno", active: false, groupable: true, exportable: true });

    expect(getOperationalHeaderBreakdownFields([filterOnly, notGroupable, inactive, breakdown]).map((candidate) => candidate.slug)).toEqual(["area"]);
  });

  it("does not use grouping_order for report field order", () => {
    const first = field({ id: 1, slug: "first", label: "First", sort_order: 10, grouping_order: 999 });
    const second = field({ id: 2, slug: "second", label: "Second", sort_order: 20, grouping_order: 1 });

    expect(sortOperationalHeaderReportFields([second, first]).map((candidate) => candidate.slug)).toEqual(["first", "second"]);
  });

  it("maps exportable fields to report columns", () => {
    expect(toOperationalHeaderReportColumn(field({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      sort_order: 30,
    }))).toEqual({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      sort_order: 30,
    });
  });
});
