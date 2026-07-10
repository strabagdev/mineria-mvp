import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("catalog admin workspace delete confirmations", () => {
  it("opens a UI dialog for visible catalog deletions before calling delete handlers", () => {
    const source = readFileSync("src/components/planning/catalog-admin-workspace.tsx", "utf8");

    expect(source).toContain("DeleteConfirmationDialog");
    expect(source).not.toContain('entityType: "Nivel"');
    expect(source).toContain('entityType: "Tipo"');
    expect(source).toContain('entityType: "Detalle"');
    expect(source).toContain("Los detalles asociados tambien seran eliminados.");
    expect(source).not.toContain("onConfirm: () => onDeleteLevel(level.id)");
    expect(source).toContain("onConfirm: () => onDeleteType(type.id)");
    expect(source).toContain("onConfirm: () => onDeleteDetail(detail.id)");
  });
});
