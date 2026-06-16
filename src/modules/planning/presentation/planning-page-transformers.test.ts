import { describe, expect, it } from "vitest";
import {
  findSegmentContinuation,
  getProgrammableActivityTypes,
  getProgrammablePlanningCategories,
  getProgrammablePlanningTypes,
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
        id: 11,
        slug: "desarrollo",
        label: "desarrollo",
        details: [
          { id: 110, label: "Avance galeria" },
        ],
      },
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
  it("keeps only unitary activity types as programmable planning types", () => {
    expect(getProgrammableActivityTypes(catalog[0]).map((type) => type.label)).toEqual(["unitaria"]);
  });

  it("keeps activity and interference as programmable planning categories", () => {
    expect(getProgrammablePlanningCategories(catalog).map((category) => category.slug)).toEqual([
      "actividad",
      "interferencia",
    ]);
  });

  it("keeps interference catalog types available for planned interference", () => {
    expect(getProgrammablePlanningTypes(catalog[1]).map((type) => type.label)).toEqual(["mantencion"]);
  });

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

  it("syncs invalid planned interference selections back to valid interference catalog defaults", () => {
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
      category: "interferencia",
      level: "NTI",
      item_type: "mantencion",
      description: "MX",
    });
  });

  it("syncs non-unitary planned activity selections back to unitary", () => {
    const nonUnitaryForm: PlanningItemForm = {
      activity_group_id: "group-1",
      item_date: "2026-05-06",
      start_time: "08:00",
      end_time: "09:00",
      shift: "Dia",
      level: "NTI",
      front: "GT1",
      category: "actividad",
      tracking_type: "programado",
      item_type: "desarrollo",
      description: "Avance galeria",
      notes: "",
    };

    expect(syncPlanningForm(nonUnitaryForm, catalog, levels)).toMatchObject({
      category: "actividad",
      item_type: "unitaria",
      description: "Extraccion",
    });
  });

  it("does not fall back to another catalog type when no programmable type exists", () => {
    const catalogWithoutProgrammableActivityType: CatalogCategory[] = [
      {
        slug: "actividad",
        label: "Actividad",
        types: [
          {
            id: 11,
            slug: "desarrollo",
            label: "desarrollo",
            details: [{ id: 110, label: "Avance galeria" }],
          },
        ],
      },
      {
        slug: "interferencia",
        label: "Interferencia",
        types: [],
      },
    ];

    const form = syncPlanningForm(
      {
        activity_group_id: "group-1",
        item_date: "2026-05-06",
        start_time: "08:00",
        end_time: "09:00",
        shift: "Dia",
        level: "NTI",
        front: "GT1",
        category: "actividad",
        tracking_type: "programado",
        item_type: "desarrollo",
        description: "Avance galeria",
        notes: "",
      },
      catalogWithoutProgrammableActivityType,
      levels
    );

    expect(form).toMatchObject({
      category: "actividad",
      item_type: "",
      description: "",
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

  it("keeps planned interferences visible as planned Gantt groups", () => {
    const groups = groupPlanningItems([
      planningItem({
        id: 5,
        category: "interferencia",
        item_type: "mantencion",
        description: "MX",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      category: "interferencia",
      item_type: "mantencion",
      description: "MX",
    });
    expect(groups[0].programado).toMatchObject({
      category: "interferencia",
      tracking_type: "programado",
    });
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
