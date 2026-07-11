import type {
  OperationalHeaderFieldDto,
  OperationalHeaderFieldOptionDto,
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";

export type LegacyOperationalHeaderFormOption = {
  id: number;
  value: string;
  label: string;
};

export type OperationalHeaderDynamicFormValues = Record<number, string>;

export type OperationalHeaderDynamicFormField = {
  field: OperationalHeaderFieldDto;
  options: LegacyOperationalHeaderFormOption[];
  captureState: OperationalHeaderFieldCaptureState;
};

export type OperationalHeaderFieldCaptureUnavailableReason =
  | "missing_parent"
  | "no_active_options"
  | "no_valid_options";

export type OperationalHeaderFieldCaptureState = {
  participates: boolean;
  requiredApplies: boolean;
  hasDependencies: boolean;
  parentFields: OperationalHeaderFieldDto[];
  missingParentFields: OperationalHeaderFieldDto[];
  activeOptionCount: number;
  validOptionCount: number;
  unavailableReason: OperationalHeaderFieldCaptureUnavailableReason | null;
};

function toOption(option: OperationalHeaderFieldOptionDto): LegacyOperationalHeaderFormOption {
  return {
    id: option.id,
    value: option.label || option.value,
    label: option.label || option.value,
  };
}

export function fieldParticipatesInOperationalHeaderCapture(field: OperationalHeaderFieldDto) {
  return field.active;
}

export function shouldValidateOperationalHeaderRequiredField(input: {
  field: OperationalHeaderFieldDto;
  captureState: OperationalHeaderFieldCaptureState;
}) {
  return input.field.active && input.field.required && input.captureState.requiredApplies;
}

export function getActiveOperationalHeaderOptions(field: OperationalHeaderFieldDto) {
  return [...field.options]
    .filter((option) => option.active)
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));
}

export function resolveSelectedOperationalHeaderOptionId(
  field: OperationalHeaderFieldDto | null,
  selectedValue: string,
  optionId?: number | null
) {
  const normalized = selectedValue.trim().toLowerCase();

  if (!field || (!normalized && (optionId === undefined || optionId === null))) {
    return null;
  }

  return field.options.find((option) =>
    option.active &&
    (
      (optionId !== undefined && optionId !== null && option.id === optionId) ||
      option.value.trim().toLowerCase() === normalized ||
      option.label.trim().toLowerCase() === normalized
    )
  )?.id ?? null;
}

function resolveFormSelectedValue(input: {
  field: OperationalHeaderFieldDto | null;
  dynamicValues: OperationalHeaderDynamicFormValues;
}) {
  if (!input.field) {
    return "";
  }

  return input.dynamicValues[input.field.id] ?? "";
}

function resolveSelectedOptionIdFromValues(input: {
  field: OperationalHeaderFieldDto | null;
  dynamicValues: OperationalHeaderDynamicFormValues;
}) {
  return resolveSelectedOperationalHeaderOptionId(
    input.field,
    resolveFormSelectedValue(input)
  );
}

export function fieldHasOperationalHeaderDependencies(config: OperationalHeaderResponseDto, fieldId: number) {
  return config.dependencies.some((dependency) => dependency.field_id === fieldId);
}

export function optionMatchesOperationalHeaderDependencies(input: {
  config: OperationalHeaderResponseDto;
  option: OperationalHeaderFieldOptionDto;
  field: OperationalHeaderFieldDto;
  fieldsById: Map<number, OperationalHeaderFieldDto>;
  dynamicValues: OperationalHeaderDynamicFormValues;
  optionIdsByFieldId?: Map<number, number | null | undefined>;
}) {
  if (!fieldHasOperationalHeaderDependencies(input.config, input.field.id)) {
    return true;
  }

  const dependencies = input.config.dependencies.filter((dependency) =>
    dependency.field_id === input.field.id &&
    dependency.option_id === input.option.id
  );

  if (!dependencies.length) {
    return false;
  }

  return dependencies.some((dependency) => {
    const parentField = input.fieldsById.get(dependency.depends_on_field_id) ?? null;
    const selectedParentOptionId = input.optionIdsByFieldId?.has(dependency.depends_on_field_id)
      ? resolveSelectedOperationalHeaderOptionId(
        parentField,
        input.dynamicValues[dependency.depends_on_field_id] ?? "",
        input.optionIdsByFieldId.get(dependency.depends_on_field_id)
      )
      : resolveSelectedOptionIdFromValues({
        field: parentField,
        dynamicValues: input.dynamicValues,
      });

    return selectedParentOptionId === dependency.depends_on_option_id;
  });
}

export function resolveOperationalHeaderFieldCaptureState(input: {
  config: OperationalHeaderResponseDto;
  field: OperationalHeaderFieldDto;
  dynamicValues: OperationalHeaderDynamicFormValues;
  options: LegacyOperationalHeaderFormOption[];
  optionIdsByFieldId?: Map<number, number | null | undefined>;
}): OperationalHeaderFieldCaptureState {
  const participates = fieldParticipatesInOperationalHeaderCapture(input.field);
  const fieldsById = new Map(input.config.fields.map((field) => [field.id, field]));
  const fieldDependencies = input.config.dependencies.filter((dependency) =>
    dependency.field_id === input.field.id
  );
  const parentFields = Array.from(new Map(fieldDependencies
    .map((dependency) => fieldsById.get(dependency.depends_on_field_id) ?? null)
    .filter((field): field is OperationalHeaderFieldDto => Boolean(field))
    .map((field) => [field.id, field])).values());
  const missingParentFields = parentFields.filter((parentField) => {
    const optionId = input.optionIdsByFieldId?.get(parentField.id);
    return !resolveSelectedOperationalHeaderOptionId(
      parentField,
      input.dynamicValues[parentField.id] ?? "",
      optionId
    );
  });
  const activeOptionCount = input.field.input_type === "select"
    ? getActiveOperationalHeaderOptions(input.field).length
    : 0;
  const validOptionCount = input.field.input_type === "select" ? input.options.length : 0;
  const hasDependencies = fieldDependencies.length > 0;
  const unavailableReason = input.field.input_type === "select"
    ? activeOptionCount === 0
      ? "no_active_options"
      : missingParentFields.length
        ? "missing_parent"
        : validOptionCount === 0
          ? "no_valid_options"
          : null
    : null;

  return {
    participates,
    requiredApplies: participates && unavailableReason !== "missing_parent",
    hasDependencies,
    parentFields,
    missingParentFields,
    activeOptionCount,
    validOptionCount,
    unavailableReason,
  };
}

export function resolveOperationalHeaderDynamicFormFields(input: {
  config: OperationalHeaderResponseDto | null | undefined;
  dynamicValues: OperationalHeaderDynamicFormValues;
  optionIdsByFieldId?: Map<number, number | null | undefined>;
}): OperationalHeaderDynamicFormField[] {
  const config = input.config;

  if (!config) {
    return [];
  }

  const fieldsById = new Map(config.fields.map((field) => [field.id, field]));

  return config.fields
    .filter(fieldParticipatesInOperationalHeaderCapture)
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label))
    .map((field) => {
      const options = field.input_type === "select"
        ? getActiveOperationalHeaderOptions(field)
          .filter((option) => optionMatchesOperationalHeaderDependencies({
            config,
            option,
            field,
            fieldsById,
            dynamicValues: input.dynamicValues,
            optionIdsByFieldId: input.optionIdsByFieldId,
          }))
          .map(toOption)
        : [];

      return {
        field,
        options,
        captureState: resolveOperationalHeaderFieldCaptureState({
          config,
          field,
          dynamicValues: input.dynamicValues,
          options,
          optionIdsByFieldId: input.optionIdsByFieldId,
        }),
      };
    });
}
