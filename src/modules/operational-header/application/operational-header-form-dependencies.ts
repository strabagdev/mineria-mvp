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
};

function toOption(option: OperationalHeaderFieldOptionDto): LegacyOperationalHeaderFormOption {
  return {
    id: option.id,
    value: option.label || option.value,
    label: option.label || option.value,
  };
}

function resolveSelectedOptionId(field: OperationalHeaderFieldDto | null, selectedValue: string) {
  const normalized = selectedValue.trim().toLowerCase();

  if (!field || !normalized) {
    return null;
  }

  return field.options.find((option) =>
    option.active &&
    (
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
  return resolveSelectedOptionId(
    input.field,
    resolveFormSelectedValue(input)
  );
}

function fieldHasDependencies(config: OperationalHeaderResponseDto, fieldId: number) {
  return config.dependencies.some((dependency) => dependency.field_id === fieldId);
}

function optionMatchesGenericDependencies(input: {
  config: OperationalHeaderResponseDto;
  option: OperationalHeaderFieldOptionDto;
  field: OperationalHeaderFieldDto;
  fieldsById: Map<number, OperationalHeaderFieldDto>;
  dynamicValues: OperationalHeaderDynamicFormValues;
}) {
  if (!fieldHasDependencies(input.config, input.field.id)) {
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
    const selectedParentOptionId = resolveSelectedOptionIdFromValues({
      field: parentField,
      dynamicValues: input.dynamicValues,
    });

    return selectedParentOptionId === dependency.depends_on_option_id;
  });
}

export function resolveOperationalHeaderDynamicFormFields(input: {
  config: OperationalHeaderResponseDto | null | undefined;
  dynamicValues: OperationalHeaderDynamicFormValues;
}): OperationalHeaderDynamicFormField[] {
  const config = input.config;

  if (!config) {
    return [];
  }

  const fieldsById = new Map(config.fields.map((field) => [field.id, field]));

  return config.fields
    .filter((field) => field.active)
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label))
    .map((field) => ({
      field,
      options: field.input_type === "select"
        ? [...field.options]
          .filter((option) => option.active)
          .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label))
          .filter((option) => optionMatchesGenericDependencies({
            config,
            option,
            field,
            fieldsById,
            dynamicValues: input.dynamicValues,
          }))
          .map(toOption)
        : [],
    }));
}
