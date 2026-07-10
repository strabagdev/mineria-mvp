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

  it("normalizes optional operational header values", () => {
    const payload = normalizePlanningItemMutationPayload({
      activity_group_id: "group-1",
      item_date: "2026-06-16",
      start_time: "08:00",
      end_time: "09:00",
      shift: "Dia",
      category: "actividad",
      tracking_type: "programado",
      item_type: "Perforacion",
      description: "Avance",
      operational_header_values: [
        { field_id: 30, value: " Mina ", option_id: 300 },
        { field_id: Number.NaN, value: "Ignorar" },
      ],
    });

    expect(payload.operational_header_values).toEqual([
      { field_id: 30, value: "Mina", option_id: 300 },
    ]);
  });
});
