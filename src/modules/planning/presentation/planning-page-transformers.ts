import {
  compareGanttGroupingPaths,
  formatLocalDateIso,
  getDefaultShiftTimes,
  resolveGanttGroupingPath,
  type GanttGroupingField,
  type ShiftKey,
} from "./planning-page-helpers";
import type {
  CatalogCategory,
  CatalogType,
  DetailAdminForm,
  PlanningGroup,
  PlanningItem,
  PlanningItemForm,
} from "./planning-page-models";

export function isProgrammableActivityType(type: CatalogType) {
  return type.slug === "unitaria" || type.label.toLowerCase() === "unitaria";
}

export function getProgrammableActivityTypes(category: CatalogCategory | null | undefined) {
  return category?.slug === "actividad" ? category.types.filter(isProgrammableActivityType) : [];
}

export function getProgrammablePlanningCategories(categories: CatalogCategory[]) {
  return categories.filter((category) => category.slug === "actividad" || category.slug === "interferencia");
}

export function getProgrammablePlanningTypes(category: CatalogCategory | null | undefined) {
  if (!category) {
    return [];
  }

  if (category.slug === "actividad") {
    return getProgrammableActivityTypes(category);
  }

  if (category.slug === "interferencia") {
    return category.types;
  }

  return [];
}

export function toInitialPlanningForm(
  categories: CatalogCategory[],
  shift: ShiftKey = "Dia",
  itemDate = formatLocalDateIso()
): PlanningItemForm {
  const defaultCategory = categories.find((category) => category.slug === "actividad") ?? {
    slug: "actividad" as const,
    label: "Actividad",
    types: [],
  };
  const defaultType = getProgrammableActivityTypes(defaultCategory)[0];
  const defaultDetail = defaultType?.details[0];
  const defaultTimes = getDefaultShiftTimes(shift);

  return {
    activity_group_id: crypto.randomUUID(),
    item_date: itemDate,
    start_time: defaultTimes.start_time,
    end_time: defaultTimes.end_time,
    shift,
    category: defaultCategory.slug,
    tracking_type: "programado",
    item_type: defaultType?.label ?? "",
    description: defaultDetail?.label ?? "",
    notes: "",
  };
}

export function syncPlanningForm(
  form: PlanningItemForm,
  categories: CatalogCategory[]
) {
  const fallback = toInitialPlanningForm(categories);
  const programmableCategories = getProgrammablePlanningCategories(categories);
  const normalizedCategory =
    form.tracking_type === "programado" &&
    !programmableCategories.some((category) => category.slug === form.category)
      ? programmableCategories[0]?.slug ?? fallback.category
      : form.category;
  const selectedCategory =
    categories.find((category) => category.slug === normalizedCategory) ??
    categories.find((category) => category.slug === fallback.category);

  if (!selectedCategory) {
    return fallback;
  }

  const availableTypes =
    form.tracking_type === "programado"
      ? getProgrammablePlanningTypes(selectedCategory)
      : selectedCategory.types;
  const selectedType =
    availableTypes.find((type) => type.label === form.item_type) ?? availableTypes[0];
  const selectedDetail =
    selectedType?.details.find((detail) => detail.label === form.description) ?? selectedType?.details[0];

  return {
    ...form,
    category: selectedCategory.slug,
    item_type: selectedType?.label ?? "",
    description: selectedDetail?.label ?? "",
  };
}

export function groupPlanningItems(items: PlanningItem[], groupingFields?: GanttGroupingField[]) {
  const groups = new Map<string, PlanningGroup>();

  function syncGroupSummary(group: PlanningGroup) {
    const displayItem = group.programado ?? group.realSegments[0] ?? null;

    if (!displayItem) {
      return;
    }

    group.item_date = displayItem.item_date;
    group.shift = displayItem.shift;
    group.category = displayItem.category;
    group.item_type = displayItem.item_type;
    group.description = displayItem.description;
    group.notes = group.programado?.notes ?? group.realSegments[0]?.notes ?? null;
    group.gantt_group_path = groupingFields?.length
      ? resolveGanttGroupingPath(displayItem, groupingFields)
      : undefined;
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
    if (left.gantt_group_path?.length && right.gantt_group_path?.length) {
      const groupingDelta = compareGanttGroupingPaths(left.gantt_group_path, right.gantt_group_path);

      if (groupingDelta !== 0) {
        return groupingDelta;
      }
    }

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
