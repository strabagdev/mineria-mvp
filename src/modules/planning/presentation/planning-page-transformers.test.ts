import { describe, expect, it } from "vitest";
import {
  findSegmentContinuation,
  groupPlanningItems,
  syncDetailAdminForm,
  syncPlanningForm,
  toInitialPlanningForm,
} from "./planning-page-transformers";
import type { CatalogCategory, CatalogLevel, PlanningItem, PlanningItemForm } from "./planning-page-models";

const catalog: CatalogCategory[] = [
  {
    slug: "actividad",
    label: "Actividad",
    types: [
      {
        id: 10,
        slug: "unitaria",
        label: "unitaria",
        details: [
          { id: 100, label: "Extraccion" },
          { id: 101, label: "Acuñadura" },
        ],
      },
    ],
  },
  {
    slug: "interferencia",
    label: "Interferencia",
    types: [
      {
        id: 20,
        slug: "mantencion",
        label: "mantencion",
        details: [{ id: 200, label: "MX" }],
      },
    ],
  },
];

const levels: CatalogLevel[] = [{ id: 1, slug: "nti", label: "NTI" }];

function planningItem(overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: 1,
    activity_group_id: "group-1",
    description: "Extraccion",
    item_date: "2026-05-06",
    start: "08:00",
    end: "09:00",
    shift: "Dia",
    level: "NTI",
    front: "GT1",
    category: "actividad",
    tracking_type: "programado",
    item_type: "unitaria",
    notes: null,
    ...overrides,
  };
}

describe("planning page transformers", () => {
  it("creates an initial planning form from catalog defaults", () => {
    const form = toInitialPlanningForm(catalog, levels, "Noche", "2026-05-06");

    expect(form).toMatchObject({
      item_date: "2026-05-06",
      start_time: "20:00",
      end_time: "21:00",
      shift: "Noche",
      level: "NTI",
      category: "actividad",
      tracking_type: "programado",
      item_type: "unitaria",
      description: "Extraccion",
      notes: "",
    });
    expect(form.activity_group_id).toEqual(expect.any(String));
  });

  it("syncs invalid planning form selections back to valid catalog defaults", () => {
    const staleForm: PlanningItemForm = {
      activity_group_id: "group-1",
      item_date: "2026-05-06",
      start_time: "08:00",
      end_time: "09:00",
      shift: "Dia",
      level: "OLD",
      front: "GT1",
      category: "interferencia",
      tracking_type: "programado",
      item_type: "missing",
      description: "missing",
      notes: "",
    };

    expect(syncPlanningForm(staleForm, catalog, levels)).toMatchObject({
      category: "actividad",
      level: "NTI",
      item_type: "unitaria",
      description: "Extraccion",
    });
  });

  it("groups planned items and real segments by activity group", () => {
    const items = [
      planningItem({ id: 3, activity_group_id: "group-2", start: "11:00" }),
      planningItem({ id: 2, tracking_type: "real", start: "09:00", end: "10:00" }),
      planningItem({ id: 1, start: "08:00", end: "12:00", notes: "planned note" }),
      planningItem({ id: 4, tracking_type: "real", start: "08:00", end: "09:00" }),
    ];

    const groups = groupPlanningItems(items);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      activity_group_id: "group-1",
      description: "Extraccion",
      notes: "planned note",
    });
    expect(groups[0].programado?.id).toBe(1);
    expect(groups[0].realSegments.map((segment) => segment.id)).toEqual([4, 2]);
    expect(groups[1].activity_group_id).toBe("group-2");
  });

  it("finds previous and next real segment continuation", () => {
    const groups = groupPlanningItems([
      planningItem({ id: 1, start: "08:00", end: "12:00" }),
      planningItem({ id: 2, tracking_type: "real", start: "08:00", end: "09:00" }),
      planningItem({ id: 3, tracking_type: "real", start: "09:00", end: "10:00" }),
      planningItem({ id: 4, tracking_type: "real", start: "10:00", end: "11:00" }),
    ]);

    const current = groups[0].realSegments[1];

    expect(findSegmentContinuation(current, groups)).toEqual({
      previous: groups[0].realSegments[0],
      next: groups[0].realSegments[2],
    });
    expect(findSegmentContinuation(groups[0].programado, groups)).toBeNull();
  });

  it("normalizes detail admin form against the selected category", () => {
    expect(
      syncDetailAdminForm(
        { category: "interferencia", typeId: "", label: "MX" },
        catalog
      )
    ).toEqual({
      category: "interferencia",
      typeId: "20",
      label: "MX",
    });
  });
});
