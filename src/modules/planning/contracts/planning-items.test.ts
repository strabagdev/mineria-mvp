import { describe, expect, it } from "vitest";
import { normalizePlanningItemMutationPayload } from "./planning-items";

describe("planning item contracts", () => {
  it("normalizes routing fields without lowercasing catalog labels", () => {
    const payload = normalizePlanningItemMutationPayload({
      activity_group_id: "group-1",
      item_date: "2026-06-16",
      start_time: "08:00",
      end_time: "09:00",
      shift: "Dia",
      level: "NTI",
      front: "GT1",
      category: " Interferencia ",
      tracking_type: " Programado ",
      item_type: " Administrativa ",
      description: " Permiso interno ",
      notes: " Nota ",
    });

    expect(payload).toMatchObject({
      category: "interferencia",
      tracking_type: "programado",
      item_type: "Administrativa",
      description: "Permiso interno",
      notes: "Nota",
    });
  });
});
