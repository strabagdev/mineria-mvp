import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reporting operational header UI", () => {
  it("renders operational header columns in the reports table without duplicating legacy columns", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("const reportOperationalHeaderColumns = report?.operational_header_columns");
    expect(pageSource).toContain("const operationalHeaderColumns = useMemo(");
    expect(pageSource).not.toContain("operationalHeaderLegacyColumns");
    expect(pageSource).not.toContain("showLegacyLevelColumn");
    expect(pageSource).not.toContain("showLegacyFrontColumn");
    expect(pageSource).toContain("operationalHeaderColumns.map((column) => (");
    expect(pageSource).toContain("row.operational_header_values?.[column.slug]?.value ?? \"\"");
  });

  it("builds CSV exports from report operational header columns only", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("downloadFilteredRows(");
    expect(pageSource).toContain("operationalHeaderColumns: ReportOperationalHeaderColumn[]");
    expect(pageSource).toContain("...operationalHeaderColumns.map((column) => column.label)");
    expect(pageSource).toContain("...operationalHeaderColumns.map((column) => row.operational_header_values?.[column.slug]?.value ?? \"\")");
  });

  it("keeps operational header rendering in the reports page table", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("operationalHeaderColumns");
    expect(pageSource).toContain("buildReportXlsxWorkbook");
  });

  it("renders report filters from operational header configuration", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("fetchOperationalHeaderConfig");
    expect(pageSource).toContain("getOperationalHeaderFilterableFields(config?.fields ?? [])");
    expect(pageSource).toContain("operationalHeaderFilterFields.map((field) => (");
    expect(pageSource).toContain("field.input_type === \"select\"");
    expect(pageSource).toContain(".filter((option) => option.active)");
    expect(pageSource).toContain("updateOperationalHeaderFilter(field, event.target.value)");
  });

  it("does not render fixed legacy level/front report controls", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).not.toContain("catalog.levels.map((level)");
    expect(pageSource).not.toContain("updateFilter(\"level\"");
    expect(pageSource).not.toContain("updateFilter(\"front\"");
  });

  it("renders dynamic operational header breakdowns instead of fixed legacy breakdowns", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("getOperationalHeaderBreakdownGroups");
    expect(pageSource).toContain("breakdowns?.by_operational_header");
    expect(pageSource).toContain("operationalHeaderBreakdownGroups.map((group) => (");
    expect(pageSource).not.toContain("title=\"Por nivel\" rows={breakdowns?.by_level");
    expect(pageSource).not.toContain("title=\"Por frente\" rows={breakdowns?.by_front");
    expect(pageSource).toContain("title=\"Por turno\" rows={breakdowns?.by_shift");
    expect(pageSource).toContain("title=\"Por categoría\" rows={breakdowns?.by_category");
    expect(pageSource).toContain("title=\"Por vista\" rows={breakdowns?.by_tracking_type");
    expect(pageSource).toContain("title=\"Por tipo\" rows={breakdowns?.by_item_type");
  });
});
