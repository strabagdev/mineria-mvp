import { assertBrowserOnline } from "@/lib/networkStatus";
import type {
  AssignmentFieldCreateRequestDto,
  AssignmentFieldDto,
  AssignmentFieldOptionCreateRequestDto,
  AssignmentFieldOptionDto,
  AssignmentFieldOptionUpdateRequestDto,
  AssignmentFieldUpdateRequestDto,
  AssignmentTarget,
  AssignmentTypeCreateRequestDto,
  AssignmentTypeDto,
  AssignmentTypeUpdateRequestDto,
  PlanningAssignmentDto,
  PlanningAssignmentInputDto,
  PlanningAssignmentsReplaceRequestDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";

async function requestJson<T>(path: string, input: RequestInit & { accessToken?: string } = {}) {
  assertBrowserOnline();

  if (!input.accessToken) {
    throw new Error("Necesitas iniciar sesion para administrar asignaciones.");
  }

  const response = await fetch(path, {
    ...input,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      ...input.headers,
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String((json as { error?: unknown }).error ?? "No se pudo completar la operacion."));
  }

  return json as T;
}

export async function fetchAssignmentTypes(accessToken?: string, input: { activeOnly?: boolean } = {}) {
  const active = input.activeOnly === false ? "false" : "true";
  const json = await requestJson<{ types?: AssignmentTypeDto[] }>(`/api/assignment-types?active=${active}`, {
    accessToken,
  });
  return Array.isArray(json.types) ? json.types : [];
}

export async function createAssignmentType(payload: AssignmentTypeCreateRequestDto, accessToken?: string) {
  const json = await requestJson<{ type: AssignmentTypeDto }>("/api/assignment-types", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.type;
}

export async function updateAssignmentType(payload: AssignmentTypeUpdateRequestDto, accessToken?: string) {
  const json = await requestJson<{ type: AssignmentTypeDto }>("/api/assignment-types", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.type;
}

export async function deleteAssignmentType(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/assignment-types", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function fetchAssignmentFields(
  accessToken?: string,
  input: { assignmentTypeId?: number; activeOnly?: boolean } = {}
) {
  const params = new URLSearchParams({ active: input.activeOnly === false ? "false" : "true" });
  if (input.assignmentTypeId) params.set("assignment_type_id", String(input.assignmentTypeId));
  const json = await requestJson<{ fields?: AssignmentFieldDto[] }>(`/api/assignment-fields?${params}`, { accessToken });
  return Array.isArray(json.fields) ? json.fields : [];
}

export async function createAssignmentField(payload: AssignmentFieldCreateRequestDto, accessToken?: string) {
  const json = await requestJson<{ field: AssignmentFieldDto }>("/api/assignment-fields", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function updateAssignmentField(payload: AssignmentFieldUpdateRequestDto, accessToken?: string) {
  const json = await requestJson<{ field: AssignmentFieldDto }>("/api/assignment-fields", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function deleteAssignmentField(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/assignment-fields", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function fetchAssignmentFieldOptions(fieldId: number, accessToken?: string) {
  const json = await requestJson<{ options?: AssignmentFieldOptionDto[] }>(
    `/api/assignment-field-options?field_id=${encodeURIComponent(String(fieldId))}`,
    { accessToken }
  );
  return Array.isArray(json.options) ? json.options : [];
}

export async function createAssignmentFieldOption(
  payload: AssignmentFieldOptionCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: AssignmentFieldOptionDto }>("/api/assignment-field-options", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.option;
}

export async function updateAssignmentFieldOption(
  payload: AssignmentFieldOptionUpdateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: AssignmentFieldOptionDto }>("/api/assignment-field-options", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.option;
}

export async function deleteAssignmentFieldOption(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/assignment-field-options", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function fetchPlanningAssignments(planningItemId: number, accessToken?: string) {
  return fetchPlanningAssignmentsForTarget({ target_kind: "planning_item", target_id: planningItemId }, accessToken);
}

export async function fetchPlanningAssignmentsForTarget(target: AssignmentTarget, accessToken?: string) {
  const params = new URLSearchParams({
    target_kind: target.target_kind,
    target_id: String(target.target_id),
  });
  const json = await requestJson<{ assignments?: PlanningAssignmentDto[] }>(
    `/api/planning-assignments?${params}`,
    { accessToken }
  );
  return Array.isArray(json.assignments) ? json.assignments : [];
}

export async function fetchPlanningAssignmentsForItems(planningItemIds: number[], accessToken?: string) {
  if (!planningItemIds.length) return [];
  const json = await requestJson<{ assignments?: PlanningAssignmentDto[] }>(
    `/api/planning-assignments?planning_item_ids=${encodeURIComponent(planningItemIds.join(","))}`,
    { accessToken }
  );
  return Array.isArray(json.assignments) ? json.assignments : [];
}

export async function replacePlanningAssignments(payload: PlanningAssignmentsReplaceRequestDto, accessToken?: string) {
  if (payload.target) {
    return savePlanningAssignmentsForTarget(payload.target, payload.assignments ?? [], accessToken);
  }

  if (payload.execution_segment_id) {
    return savePlanningAssignmentsForTarget(
      { target_kind: "execution_segment", target_id: payload.execution_segment_id },
      payload.assignments ?? [],
      accessToken
    );
  }

  const json = await requestJson<{ assignments?: PlanningAssignmentDto[] }>("/api/planning-assignments", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return Array.isArray(json.assignments) ? json.assignments : [];
}

export async function savePlanningAssignmentsForTarget(
  target: AssignmentTarget,
  assignments: PlanningAssignmentInputDto[],
  accessToken?: string
) {
  const payload: PlanningAssignmentsReplaceRequestDto = target.target_kind === "planning_item"
    ? { planning_item_id: target.target_id, assignments }
    : { target, assignments };
  const json = await requestJson<{ assignments?: PlanningAssignmentDto[] }>("/api/planning-assignments", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return Array.isArray(json.assignments) ? json.assignments : [];
}
