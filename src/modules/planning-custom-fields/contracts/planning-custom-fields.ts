export type PlanningCustomFieldInputType = "select" | "multi_select" | "number" | "text" | "date" | "boolean";
export type PlanningCustomFieldAppliesTo = "planned" | "actual" | "both";
export type PlanningCustomFieldJson = Record<string, string | number | boolean | null>;

export const PLANNING_CUSTOM_FIELD_ICON_KEYS = [
  "truck",
  "hard-hat",
  "users",
  "building",
  "calendar",
  "map-pin",
  "clipboard-list",
  "wrench",
  "shield-alert",
  "file-text",
  "tag",
  "clock",
  "user",
  "package",
  "layers",
] as const;

export type PlanningCustomFieldIconKey = (typeof PLANNING_CUSTOM_FIELD_ICON_KEYS)[number];

export type PlanningCustomFieldOptionDto = {
  id: number;
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: PlanningCustomFieldJson;
};

export type PlanningCustomFieldDto = {
  id: number;
  slug: string;
  label: string;
  icon_key: PlanningCustomFieldIconKey | null;
  input_type: PlanningCustomFieldInputType;
  active: boolean;
  required: boolean;
  applies_to: PlanningCustomFieldAppliesTo;
  sort_order: number;
  config: Record<string, unknown>;
  options: PlanningCustomFieldOptionDto[];
};

export type PlanningCustomFieldValueDto = {
  id: number;
  field_id: number;
  planning_item_id: number | null;
  execution_segment_id: number | null;
  activity_group_id: string | null;
  option_id: number | null;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: PlanningCustomFieldJson;
};

export type PlanningCustomFieldCreateRequestDto = {
  slug?: string;
  label?: string;
  icon_key?: string | null;
  input_type?: string;
  active?: boolean;
  required?: boolean;
  applies_to?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
};

export type PlanningCustomFieldUpdateRequestDto = PlanningCustomFieldCreateRequestDto & {
  id?: number;
};

export type PlanningCustomFieldOptionCreateRequestDto = {
  field_id?: number;
  value?: string;
  label?: string;
  active?: boolean;
  sort_order?: number;
  metadata?: PlanningCustomFieldJson;
};

export type PlanningCustomFieldOptionUpdateRequestDto = PlanningCustomFieldOptionCreateRequestDto & {
  id?: number;
};

export type PlanningCustomFieldValueInputDto = {
  field_id: number;
  option_id?: number | null;
  option_ids?: number[];
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: PlanningCustomFieldJson;
};

export type PlanningCustomFieldValuesSaveRequestDto = {
  planning_item_id?: number | null;
  execution_segment_id?: number | null;
  activity_group_id?: string | null;
  values?: PlanningCustomFieldValueInputDto[];
};

export function isPlanningCustomFieldInputType(value: string): value is PlanningCustomFieldInputType {
  return ["select", "multi_select", "number", "text", "date", "boolean"].includes(value);
}

export function isPlanningCustomFieldAppliesTo(value: string): value is PlanningCustomFieldAppliesTo {
  return ["planned", "actual", "both"].includes(value);
}

export function isPlanningCustomFieldIconKey(value: string): value is PlanningCustomFieldIconKey {
  return (PLANNING_CUSTOM_FIELD_ICON_KEYS as readonly string[]).includes(value);
}
