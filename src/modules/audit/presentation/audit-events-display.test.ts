import { describe, expect, it } from "vitest";
import type { AuditEventDto } from "@/modules/audit/contracts/audit";
import {
  formatAuditEntity,
  formatJsonPreview,
  getAuditActionLabel,
  getAuditEventSummary,
} from "./audit-events-display";

const baseEvent: AuditEventDto = {
  id: 1,
  created_at: "2026-06-02T05:00:00.000Z",
  user: { id: "user-1", email: "admin@empresa.com" },
  action: "planning_item.created",
  entity: { type: "planning_item", id: "36" },
  before: null,
  after: null,
  metadata: null,
};

describe("audit event display helpers", () => {
  it("builds human summaries from known actions", () => {
    expect(getAuditEventSummary(baseEvent)).toBe("Programación creada");
  });

  it("prioritizes metadata summary when available", () => {
    expect(
      getAuditEventSummary({
        ...baseEvent,
        action: "planning_assignments.replaced",
        metadata: { summary: { cuadrillas: 2, equipos: 1 } },
      })
    ).toBe("Cuadrillas: 2 · Equipos: 1");
  });

  it("formats entities and empty json blocks", () => {
    expect(formatAuditEntity(baseEvent.entity)).toBe("planning_item #36");
    expect(formatJsonPreview(null)).toBe("Sin datos");
    expect(formatJsonPreview({})).toBe("Sin datos");
    expect(formatJsonPreview([])).toBe("Sin datos");
  });

  it("does not expose technical wrapper keys in json labels", () => {
    expect(formatJsonPreview({ metadata: { reason: "ok" }, before: { id: 1 }, after: { id: 2 } })).toContain(
      "Detalles del evento"
    );
    expect(formatJsonPreview({ metadata: { reason: "ok" } })).not.toContain("metadata");
  });

  it("humanizes unknown actions instead of returning the raw technical key", () => {
    expect(getAuditActionLabel({ ...baseEvent, action: "configurable_entity.updated" })).toBe(
      "Configurable entity modificado"
    );
  });
});
