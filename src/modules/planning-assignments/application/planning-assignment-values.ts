import type {
  AssignmentJson,
  AssignmentTarget,
  AssignmentTypeDto,
  PlanningAssignmentInputDto,
  PlanningAssignmentValueInputDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";

export type NormalizedPlanningAssignmentValue = {
  field_id: number;
  option_id?: number;
  value_text?: string;
  value_number?: number;
  value_date?: string;
  value_boolean?: boolean;
  value_json: AssignmentJson;
};

export type NormalizedPlanningAssignment = {
  assignment_type_id: number;
  instance_order: number;
  values: NormalizedPlanningAssignmentValue[];
};

export function buildPlanningAssignmentsReplaceParams(
  planningItemId: number,
  assignments: NormalizedPlanningAssignment[]
) {
  return {
    p_planning_item_id: planningItemId,
    p_assignments: assignments,
  };
}

export function buildAssignmentsTargetReplaceParams(
  target: AssignmentTarget,
  assignments: NormalizedPlanningAssignment[]
) {
  return {
    p_target_kind: target.target_kind,
    p_target_id: target.target_id,
    p_assignments: assignments,
  };
}

function valueJson(value?: PlanningAssignmentValueInputDto) {
  return value?.value_json ?? {};
}

function normalizeFieldValue(
  field: AssignmentTypeDto["fields"][number],
  input: PlanningAssignmentValueInputDto | undefined
): NormalizedPlanningAssignmentValue[] {
  if (!field.active) {
    if (input) throw new Error(`El campo ${field.label} no esta activo.`);
    return [];
  }

  if (field.input_type === "select") {
    const optionId = input?.option_id ?? null;
    if (field.required && optionId === null) throw new Error(`El campo ${field.label} es obligatorio.`);
    if (optionId === null) return [];
    if (!Number.isFinite(optionId)) throw new Error(`La opcion seleccionada para ${field.label} no es valida.`);
    const option = field.options.find((entry) => entry.id === optionId);
    if (!option || !option.active) throw new Error(`La opcion seleccionada para ${field.label} no es valida.`);
    return [{ field_id: field.id, option_id: optionId, value_json: valueJson(input ?? { field_id: field.id }) }];
  }

  if (field.input_type === "multi_select") {
    const optionIds = [...new Set(input?.option_ids ?? [])];
    if (field.required && optionIds.length === 0) throw new Error(`El campo ${field.label} es obligatorio.`);
    for (const optionId of optionIds) {
      const option = field.options.find((entry) => entry.id === optionId);
      if (!Number.isFinite(optionId) || !option || !option.active) {
        throw new Error(`Una opcion seleccionada para ${field.label} no es valida.`);
      }
    }
    return optionIds.map((optionId) => ({ field_id: field.id, option_id: optionId, value_json: valueJson(input ?? { field_id: field.id }) }));
  }

  if (field.input_type === "number") {
    const numberValue = input?.value_number ?? null;
    if (field.required && numberValue === null) throw new Error(`El campo ${field.label} es obligatorio.`);
    if (numberValue === null) return [];
    if (!Number.isFinite(numberValue)) throw new Error(`El valor numerico de ${field.label} no es valido.`);
    return [{ field_id: field.id, value_number: numberValue, value_json: valueJson(input) }];
  }

  if (field.input_type === "date") {
    const dateValue = input?.value_date?.trim() || null;
    if (field.required && !dateValue) throw new Error(`El campo ${field.label} es obligatorio.`);
    if (!dateValue) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) throw new Error(`La fecha de ${field.label} no es valida.`);
    return [{ field_id: field.id, value_date: dateValue, value_json: valueJson(input) }];
  }

  if (field.input_type === "boolean") {
    const booleanValue = input?.value_boolean ?? null;
    if (field.required && booleanValue === null) throw new Error(`El campo ${field.label} es obligatorio.`);
    if (booleanValue === null) return [];
    return [{ field_id: field.id, value_boolean: booleanValue, value_json: valueJson(input) }];
  }

  const textValue = input?.value_text?.trim() || null;
  if (field.required && !textValue) throw new Error(`El campo ${field.label} es obligatorio.`);
  if (!textValue) return [];
  return [{ field_id: field.id, value_text: textValue, value_json: valueJson(input) }];
}

export function normalizePlanningAssignments(
  types: AssignmentTypeDto[],
  assignments: PlanningAssignmentInputDto[]
): NormalizedPlanningAssignment[] {
  const typesById = new Map(types.map((type) => [type.id, type]));
  const seenInstances = new Set<string>();

  return assignments.map((assignment) => {
    const type = typesById.get(assignment.assignment_type_id);
    if (!type || !type.active) throw new Error("Uno de los tipos de asignacion no esta activo o no existe.");
    if (!Number.isInteger(assignment.instance_order) || assignment.instance_order < 1 || assignment.instance_order > type.max_instances) {
      throw new Error(`La instancia de ${type.label} debe estar entre 1 y ${type.max_instances}.`);
    }
    const instanceKey = `${type.id}:${assignment.instance_order}`;
    if (seenInstances.has(instanceKey)) throw new Error(`La instancia ${assignment.instance_order} de ${type.label} esta repetida.`);
    seenInstances.add(instanceKey);

    const fieldsById = new Map(type.fields.map((field) => [field.id, field]));
    const valuesByField = new Map<number, PlanningAssignmentValueInputDto>();
    for (const value of assignment.values ?? []) {
      const field = fieldsById.get(value.field_id);
      if (!field) throw new Error(`Un campo no pertenece al tipo ${type.label}.`);
      if (valuesByField.has(value.field_id)) throw new Error(`El campo ${field.label} esta repetido.`);
      valuesByField.set(value.field_id, value);
    }

    return {
      assignment_type_id: type.id,
      instance_order: assignment.instance_order,
      values: type.fields.flatMap((field) => normalizeFieldValue(field, valuesByField.get(field.id))),
    };
  });
}
