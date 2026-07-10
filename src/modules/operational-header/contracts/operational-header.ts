export type OperationalHeaderInputType = "text" | "select";
export type OperationalHeaderJson = Record<string, string | number | boolean | null>;

export type OperationalHeaderFieldOptionDto = {
  id: number;
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: OperationalHeaderJson;
};

export type OperationalHeaderFieldDto = {
  id: number;
  slug: string;
  label: string;
  input_type: OperationalHeaderInputType;
  required: boolean;
  active: boolean;
  sort_order: number;
  groupable: boolean;
  filterable: boolean;
  visible_in_gantt: boolean;
  exportable: boolean;
  options: OperationalHeaderFieldOptionDto[];
};

export type OperationalHeaderOptionDependencyDto = {
  id: number;
  field_id: number;
  option_id: number;
  depends_on_field_id: number;
  depends_on_option_id: number;
};

export type OperationalHeaderValueDto = {
  id: number;
  field_id: number;
  activity_group_id: string;
  planning_item_id: number | null;
  execution_segment_id: number | null;
  option_id: number | null;
  value_text: string | null;
};

export type OperationalHeaderResponseDto = {
  fields: OperationalHeaderFieldDto[];
  dependencies: OperationalHeaderOptionDependencyDto[];
};

export type OperationalHeaderFieldCreateRequestDto = {
  slug?: string;
  label?: string;
  input_type?: OperationalHeaderInputType;
  required?: boolean;
  active?: boolean;
  sort_order?: number;
  groupable?: boolean;
  filterable?: boolean;
  visible_in_gantt?: boolean;
  exportable?: boolean;
};

export type OperationalHeaderFieldUpdateRequestDto = Partial<OperationalHeaderFieldCreateRequestDto> & {
  id?: number;
};

export type OperationalHeaderFieldDeleteRequestDto = {
  id?: number;
};

export type OperationalHeaderOptionCreateRequestDto = {
  entity?: "option";
  field_id?: number;
  value?: string;
  label?: string;
  active?: boolean;
  sort_order?: number;
  metadata?: unknown;
};

export type OperationalHeaderOptionUpdateRequestDto = Partial<OperationalHeaderOptionCreateRequestDto> & {
  id?: number;
};

export type OperationalHeaderOptionDeleteRequestDto = {
  entity?: "option";
  id?: number;
};

export type OperationalHeaderDependencyCreateRequestDto = {
  entity?: "dependency";
  field_id?: number;
  option_id?: number;
  depends_on_field_id?: number;
  depends_on_option_id?: number;
};

export type OperationalHeaderDependencyDeleteRequestDto = {
  entity?: "dependency";
  id?: number;
};

export function isOperationalHeaderInputType(value: string): value is OperationalHeaderInputType {
  return value === "text" || value === "select";
}
