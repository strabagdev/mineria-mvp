import type { AssignmentJson } from "@/modules/planning-assignments/contracts/planning-assignments";

export function parseAssignmentOptionMetadata(value: string): AssignmentJson {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Metadata debe ser un JSON válido.");
    }
    return parsed as AssignmentJson;
  } catch {
    throw new Error("Metadata debe ser un JSON válido.");
  }
}

export function formatAssignmentOptionMetadata(value: AssignmentJson) {
  return Object.keys(value).length ? JSON.stringify(value, null, 2) : "{}";
}
