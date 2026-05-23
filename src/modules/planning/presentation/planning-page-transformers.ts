import { formatLocalDateIso, getDefaultShiftTimes, type ShiftKey } from "./planning-page-helpers";
import type {
  CatalogCategory,
  CatalogLevel,
  DetailAdminForm,
  PlanningGroup,
  PlanningItem,
  PlanningItemForm,
} from "./planning-page-models";

export function toInitialPlanningForm(
  categories: CatalogCategory[],
  levels: CatalogLevel[],
  shift: ShiftKey = "Dia",
  itemDate = formatLocalDateIso()
): PlanningItemForm {
  const defaultCategory = categories[0] ?? {
    slug: "actividad" as const,
    label: "Actividad",
    types: [],
  };
  const defaultType = defaultCategory.types[0];
  const defaultDetail = defaultType?.details[0];
  const defaultLevel = levels[0];
  const defaultTimes = getDefaultShiftTimes(shift);

  return {
    activity_group_id: crypto.randomUUID(),
    item_date: itemDate,
    start_time: defaultTimes.start_time,
    end_time: defaultTimes.end_time,
    shift,
    level: defaultLevel?.label ?? "",
    front: "",
    category: defaultCategory.slug,
    tracking_type: "programado",
    item_type: defaultType?.label ?? "",
    description: defaultDetail?.label ?? "",
    notes: "",
  };
}

export function syncPlanningForm(
  form: PlanningItemForm,
  categories: CatalogCategory[],
  levels: CatalogLevel[]
) {
  const fallback = toInitialPlanningForm(categories, levels);
  const normalizedCategory =
    form.tracking_type === "programado" ? ("actividad" as const) : form.category;
  const selectedCategory =
    categories.find((category) => category.slug === normalizedCategory) ??
    categories.find((category) => category.slug === fallback.category);

  if (!selectedCategory) {
    return fallback;
  }

  const selectedType =
    selectedCategory.types.find((type) => type.label === form.item_type) ?? selectedCategory.types[0];
  const selectedDetail =
    selectedType?.details.find((detail) => detail.label === form.description) ?? selectedType?.details[0];

  return {
    ...form,
    category: selectedCategory.slug,
    level: levels.some((level) => level.label === form.level) ? form.level : fallback.level,
    item_type: selectedType?.label ?? "",
    description: selectedDetail?.label ?? "",
  };
}

export function groupPlanningItems(items: PlanningItem[]) {
  const groups = new Map<string, PlanningGroup>();

  function syncGroupSummary(group: PlanningGroup) {
    const displayItem = group.programado ?? group.realSegments[0] ?? null;

    if (!displayItem) {
      return;
    }

    group.item_date = displayItem.item_date;
    group.shift = displayItem.shift;
    group.level = displayItem.level;
    group.front = displayItem.front;
    group.category = displayItem.category;
    group.item_type = displayItem.item_type;
    group.description = displayItem.description;
    group.notes = group.programado?.notes ?? group.realSegments[0]?.notes ?? null;
  }

  for (const item of items) {
    const existingGroup = groups.get(item.activity_group_id);

    if (existingGroup) {
      if (item.tracking_type === "programado") {
        existingGroup.programado = item;
      } else {
        existingGroup.realSegments.push(item);
        existingGroup.realSegments.sort((left, right) =>
          `${left.item_date}-${left.start}`.localeCompare(`${right.item_date}-${right.start}`)
        );
      }
      syncGroupSummary(existingGroup);
      continue;
    }

    const nextGroup: PlanningGroup = {
      key: item.activity_group_id,
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      item_type: item.item_type,
      description: item.description,
      notes: item.notes ?? null,
      programado: item.tracking_type === "programado" ? item : null,
      realSegments: item.tracking_type === "real" ? [item] : [],
    };
    syncGroupSummary(nextGroup);
    groups.set(item.activity_group_id, nextGroup);
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftItem = left.programado ?? left.realSegments[0] ?? null;
    const rightItem = right.programado ?? right.realSegments[0] ?? null;

    if (!leftItem || !rightItem) {
      return 0;
    }

    return `${leftItem.item_date}-${leftItem.start}`.localeCompare(`${rightItem.item_date}-${rightItem.start}`);
  });
}

export function findSegmentContinuation(
  item: PlanningItem | null,
  groups: PlanningGroup[]
): { previous: PlanningItem | null; next: PlanningItem | null } | null {
  if (!item || item.tracking_type !== "real") {
    return null;
  }

  const group = groups.find((entry) => entry.activity_group_id === item.activity_group_id);
  if (!group || group.realSegments.length <= 1) {
    return null;
  }

  const index = group.realSegments.findIndex((segment) => segment.id === item.id);
  if (index === -1) {
    return null;
  }

  return {
    previous: group.realSegments[index - 1] ?? null,
    next: group.realSegments[index + 1] ?? null,
  };
}

export function syncDetailAdminForm(form: DetailAdminForm, categories: CatalogCategory[]) {
  const selectedCategory =
    categories.find((category) => category.slug === form.category) ?? categories[0] ?? null;

  if (!selectedCategory) {
    return { category: "actividad" as const, typeId: "", label: form.label };
  }

  const selectedType =
    selectedCategory.types.find((type) => String(type.id) === form.typeId) ?? selectedCategory.types[0] ?? null;

  return {
    ...form,
    category: selectedCategory.slug,
    typeId: selectedType ? String(selectedType.id) : "",
  };
}
