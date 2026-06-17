import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planning assignments UI visibility", () => {
  it("shows assignment form and summary for planned and real targets", () => {
    const pageSource = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(pageSource).toContain("<PlanningAssignmentsForm");
    expect(pageSource).toContain("<PlanningAssignmentsSummary");
    expect(pageSource).toContain("getAssignmentTargetForItem(item)");
    expect(pageSource).toContain("target_kind: \"execution_segment\"");
  });

  it("keeps the copy rules for each assignment target", () => {
    const pageSource = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(pageSource).toContain("Asignaciones planificadas");
    expect(pageSource).toContain("Asignaciones reales");
    expect(pageSource).toContain("Recursos involucrados");
  });

  it("keeps execution segment assignment saves online-only for now", () => {
    const pageSource = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(pageSource).toContain("Las asignaciones reales requieren conexión por ahora.");
    expect(pageSource).toContain("assignmentTarget.target_kind === \"execution_segment\"");
  });

  it("keeps viewers in read-only mode from the planning detail", () => {
    const pageSource = readFileSync("src/app/(app)/page.tsx", "utf8");
    const detailSource = readFileSync("src/components/planning/planning-detail-dialog.tsx", "utf8");

    expect(pageSource).toContain("readOnly={isHistoricalReadOnly || !canOperatePlanning}");
    expect(detailSource).toContain("{!readOnly ? (");
    expect(detailSource).toContain("Editar registro");
  });
});
