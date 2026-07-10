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
  category: PlanningCategoryDto;
  tracking_type: PlanningTrackingTypeDto;
  item_type: string;
  description: string;
  notes: string | null;
  operational_header_values?: PlanningItemOperationalHeaderValueDto[];
};

export type PlanningItemOperationalHeaderValueDto = {
  field_id: number;
  value: string;
  option_id?: number | null;
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
  category?: string;
  tracking_type?: string;
  item_type?: string;
  description?: string;
  notes?: string | null;
  client_mutation_id?: string | null;
  operational_header_values?: PlanningItemOperationalHeaderValueDto[];
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
  category: string;
  tracking_type: string;
  item_type: string;
  description: string;
  notes: string | null;
  operational_header_values: PlanningItemOperationalHeaderValueDto[];
};

function normalizeOperationalHeaderValues(
  values: PlanningItemMutationPayloadDto["operational_header_values"]
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => ({
      field_id: Number(value?.field_id),
      value: String(value?.value ?? "").trim(),
      option_id: value?.option_id === undefined || value?.option_id === null ? null : Number(value.option_id),
    }))
    .filter((value) => Number.isFinite(value.field_id) && value.field_id > 0);
}

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
    category: String(body.category ?? "").trim().toLowerCase(),
    tracking_type: String(body.tracking_type ?? "").trim().toLowerCase(),
    item_type: String(body.item_type ?? "").trim(),
    description: String(body.description ?? "").trim(),
    notes: String(body.notes ?? "").trim() || null,
    operational_header_values: normalizeOperationalHeaderValues(body.operational_header_values),
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
