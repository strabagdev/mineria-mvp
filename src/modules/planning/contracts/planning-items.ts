export type PlanningCategoryDto = "actividad" | "interferencia";
export type PlanningTrackingTypeDto = "programado" | "real";
export type PlanningShiftDto = "Dia" | "Noche";

export type PlanningItemDto = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: PlanningCategoryDto;
  tracking_type: PlanningTrackingTypeDto;
  item_type: string;
  description: string;
  notes: string | null;
};

export type PlanningItemsResponseDto = {
  items: PlanningItemDto[];
};

export type PlanningItemMutationPayloadDto = {
  id?: number;
  activity_group_id?: string;
  item_date?: string;
  start_time?: string;
  end_time?: string;
  shift?: string;
  level?: string;
  front?: string;
  category?: string;
  tracking_type?: string;
  item_type?: string;
  description?: string;
  notes?: string | null;
  client_mutation_id?: string | null;
};

export type PlanningItemDeleteRequestDto = {
  id?: number;
  tracking_type?: string;
};

export type NormalizedPlanningItemPayloadDto = {
  activity_group_id: string;
  client_mutation_id: string | null;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  tracking_type: string;
  item_type: string;
  description: string;
  notes: string | null;
};

export type RealSegmentRangeInputDto = {
  id?: number;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
};

export function normalizePlanningItemMutationPayload(
  body: PlanningItemMutationPayloadDto
): NormalizedPlanningItemPayloadDto {
  return {
    activity_group_id: String(body.activity_group_id ?? "").trim() || crypto.randomUUID(),
    client_mutation_id: String(body.client_mutation_id ?? "").trim() || null,
    item_date: String(body.item_date ?? "").trim(),
    start_time: String(body.start_time ?? "").trim(),
    end_time: String(body.end_time ?? "").trim(),
    shift: String(body.shift ?? "").trim(),
    level: String(body.level ?? "").trim(),
    front: String(body.front ?? "").trim(),
    category: String(body.category ?? "").trim().toLowerCase(),
    tracking_type: String(body.tracking_type ?? "").trim().toLowerCase(),
    item_type: String(body.item_type ?? "").trim().toLowerCase(),
    description: String(body.description ?? "").trim(),
    notes: String(body.notes ?? "").trim() || null,
  };
}

export function isPlanningCategoryDto(value: string): value is PlanningCategoryDto {
  return value === "actividad" || value === "interferencia";
}

export function isPlanningTrackingTypeDto(value: string): value is PlanningTrackingTypeDto {
  return value === "programado" || value === "real";
}

export function isPlanningShiftDto(value: string): value is PlanningShiftDto {
  return value === "Dia" || value === "Noche";
}
