import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Planning page local-first wiring", () => {
  it("hydrates planning from IndexedDB before reconciling with the API", () => {
    const source = readFileSync("src/app/(app)/page.tsx", "utf8");
    const localReadIndex = source.indexOf("planningLocalRepository.readByDate");
    const remoteRefreshIndex = source.indexOf("await refreshPlanningItems();", localReadIndex);

    expect(source).toContain("planningLocalRepository.readByDate");
    expect(source).toContain("planningLocalRepository.reconcileServerSnapshot");
    expect(source).toContain("planningLocalRepository.applyLocalMutation");
    expect(localReadIndex).toBeGreaterThan(-1);
    expect(remoteRefreshIndex).toBeGreaterThan(localReadIndex);
    expect(source).not.toContain("readPlanningCache<PlanningItem[]>");
    expect(source).not.toContain("savePlanningCache(");
  });

  it("distinguishes offline without a local planning snapshot", () => {
    const source = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(source).toContain("No hay datos disponibles sin conexión para esta fecha.");
    expect(source).toContain('metadata: { dataset: "planning-by-date", selectedDate }');
  });

  it("uses incremental sync as the Realtime invalidation path", () => {
    const source = readFileSync("src/app/(app)/page.tsx", "utf8");

    expect(source).toContain("pullSyncChanges");
    expect(source).toContain("planningRemoteChangeApplier.applyChanges");
    expect(source).toContain("realtime.incremental_sync_failed");
    expect(source).toContain("syncPendingPlanningMutations()");
  });
});
