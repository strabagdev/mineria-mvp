import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatAssignmentOptionMetadata,
  parseAssignmentOptionMetadata,
} from "./planning-assignments-admin-metadata";

describe("planning assignments admin panel option metadata", () => {
  it("parses option metadata JSON objects", () => {
    expect(parseAssignmentOptionMetadata('{ "familia": "Jumbo" }')).toEqual({ familia: "Jumbo" });
  });

  it("uses an empty object when metadata is blank", () => {
    expect(parseAssignmentOptionMetadata("")).toEqual({});
    expect(parseAssignmentOptionMetadata("   ")).toEqual({});
  });

  it("rejects invalid metadata JSON with a clear message", () => {
    expect(() => parseAssignmentOptionMetadata("{ familia: Jumbo }")).toThrow("Metadata debe ser un JSON válido.");
    expect(() => parseAssignmentOptionMetadata("[]")).toThrow("Metadata debe ser un JSON válido.");
  });

  it("formats existing option metadata for editing", () => {
    expect(formatAssignmentOptionMetadata({ familia: "Jumbo" })).toBe('{\n  "familia": "Jumbo"\n}');
    expect(formatAssignmentOptionMetadata({})).toBe("{}");
  });

  it("renders and submits metadata from the option form", () => {
    const source = readFileSync(
      "src/modules/planning-assignments/presentation/planning-assignments-admin-panel.tsx",
      "utf8"
    );

    expect(source).toContain("Metadata JSON");
    expect(source).toContain("metadata: parseAssignmentOptionMetadata(optionForm.metadata)");
    expect(source).toContain("metadata: formatAssignmentOptionMetadata(option.metadata)");
  });
});
