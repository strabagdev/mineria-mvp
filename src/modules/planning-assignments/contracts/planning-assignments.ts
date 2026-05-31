export type AssignmentFieldInputType = "text" | "number" | "date" | "boolean" | "select" | "multi_select";
export type AssignmentJson = Record<string, string | number | boolean | null>;

export type AssignmentFieldOptionDto = {
  id: number;
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: AssignmentJson;
};

export type AssignmentFieldDto = {
  id: number;
  assignment_type_id: number;
  slug: string;
  label: string;
  input_type: AssignmentFieldInputType;
  active: boolean;
  required: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  options: AssignmentFieldOptionDto[];
};

export type AssignmentTypeDto = {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  active: boolean;
  max_instances: number;
  sort_order: number;
  config: Record<string, unknown>;
  fields: AssignmentFieldDto[];
};

export type AssignmentTypeCreateRequestDto = {
  slug?: string;
  label?: string;
  description?: string | null;
  active?: boolean;
  max_instances?: number;
  sort_order?: number;
  config?: Record<string, unknown>;
};

export type AssignmentTypeUpdateRequestDto = AssignmentTypeCreateRequestDto & {
  id?: number;
};

export type AssignmentFieldCreateRequestDto = {
  assignment_type_id?: number;
  slug?: string;
  label?: string;
  input_type?: string;
  active?: boolean;
  required?: boolean;
  sort_order?: number;
  config?: Record<string, unknown>;
};

export type AssignmentFieldUpdateRequestDto = AssignmentFieldCreateRequestDto & {
  id?: number;
};

export type AssignmentFieldOptionCreateRequestDto = {
  field_id?: number;
  value?: string;
  label?: string;
  active?: boolean;
  sort_order?: number;
  metadata?: AssignmentJson;
};

export type AssignmentFieldOptionUpdateRequestDto = AssignmentFieldOptionCreateRequestDto & {
  id?: number;
};

export type PlanningAssignmentValueInputDto = {
  field_id: number;
  option_id?: number | null;
  option_ids?: number[];
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: AssignmentJson;
};

export type PlanningAssignmentInputDto = {
  assignment_type_id: number;
  instance_order: number;
  values: PlanningAssignmentValueInputDto[];
};

export type PlanningAssignmentsReplaceRequestDto = {
  planning_item_id?: number;
  assignments?: PlanningAssignmentInputDto[];
};

export type PlanningAssignmentValueDto = {
  id: number;
  assignment_id: number;
  field_id: number;
  option_id: number | null;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: AssignmentJson;
};

export type PlanningAssignmentDto = {
  id: number;
  planning_item_id: number;
  assignment_type_id: number;
  instance_order: number;
  values: PlanningAssignmentValueDto[];
};

export function isAssignmentFieldInputType(value: string): value is AssignmentFieldInputType {
  return ["text", "number", "date", "boolean", "select", "multi_select"].includes(value);
}
