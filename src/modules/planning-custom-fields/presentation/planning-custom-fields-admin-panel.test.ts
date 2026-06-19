import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planning custom fields admin panel delete confirmations", () => {
  it("opens a UI dialog for custom field and option deletions before deleting", () => {
    const source = readFileSync(
      "src/modules/planning-custom-fields/presentation/planning-custom-fields-admin-panel.tsx",
      "utf8"
    );

    expect(source).toContain("DeleteConfirmationDialog");
    expect(source).toContain('entityType: "Custom Field"');
    expect(source).toContain('entityType: "Custom Field Option"');
    expect(source).toContain("Las opciones asociadas tambien seran eliminadas.");
    expect(source).toContain("onConfirm: () => void removeOption(option)");
    expect(source).toContain("onConfirm: () => void removeField(field)");
    expect(source).toContain("setDraftOptions((current) => current.filter((entry) => entry.localId !== option.localId))");
  });
});
