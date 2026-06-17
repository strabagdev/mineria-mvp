import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reporting assignments UI", () => {
  it("groups report assignment rows by target kind and target id", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("getReportRowAssignmentTarget(row)");
    expect(pageSource).toContain("getReportAssignmentTargetKey(assignment.target_kind, assignment.target_id)");
    expect(pageSource).toContain("assignmentSummariesByTarget");
    expect(pageSource).toContain("assignmentRowsByTarget");
  });

  it("keeps the modal copy rules for planned, real and interference assignments", () => {
    const pageSource = readFileSync("src/app/(app)/reports/page.tsx", "utf8");

    expect(pageSource).toContain("Asignaciones planificadas");
    expect(pageSource).toContain("Asignaciones reales");
    expect(pageSource).toContain("Recursos involucrados");
    expect(pageSource).toContain("title={getReportAssignmentSectionTitle(selectedReportRow)}");
  });
});
