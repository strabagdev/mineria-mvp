import { assertBrowserOnline } from "@/lib/networkStatus";
import type {
  PlanningCustomFieldCreateRequestDto,
  PlanningCustomFieldDto,
  PlanningCustomFieldOptionCreateRequestDto,
  PlanningCustomFieldOptionDto,
  PlanningCustomFieldOptionUpdateRequestDto,
  PlanningCustomFieldUpdateRequestDto,
  PlanningCustomFieldValueDto,
  PlanningCustomFieldValuesSaveRequestDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

async function requestJson<T>(path: string, input: RequestInit & { accessToken?: string } = {}) {
  assertBrowserOnline();

  if (!input.accessToken) {
    throw new Error("Necesitas iniciar sesion para usar campos configurables.");
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

export async function fetchPlanningCustomFields(accessToken?: string, input: { activeOnly?: boolean } = {}) {
  const active = input.activeOnly === false ? "false" : "true";
  const json = await requestJson<{ fields?: PlanningCustomFieldDto[] }>(
    `/api/planning-custom-fields?active=${active}`,
    { accessToken }
  );
  return Array.isArray(json.fields) ? json.fields : [];
}

export async function createPlanningCustomField(
  payload: PlanningCustomFieldCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ field: PlanningCustomFieldDto }>("/api/planning-custom-fields", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function updatePlanningCustomField(
  payload: PlanningCustomFieldUpdateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ field: PlanningCustomFieldDto }>("/api/planning-custom-fields", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function deletePlanningCustomField(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/planning-custom-fields", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function createPlanningCustomFieldOption(
  payload: PlanningCustomFieldOptionCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: PlanningCustomFieldOptionDto }>("/api/planning-custom-field-options", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.option;
}

export async function fetchPlanningCustomFieldOptions(fieldId: number, accessToken?: string) {
  const json = await requestJson<{ options?: PlanningCustomFieldOptionDto[] }>(
    `/api/planning-custom-field-options?field_id=${encodeURIComponent(String(fieldId))}`,
    { accessToken }
  );
  return Array.isArray(json.options) ? json.options : [];
}

export async function updatePlanningCustomFieldOption(
  payload: PlanningCustomFieldOptionUpdateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: PlanningCustomFieldOptionDto }>("/api/planning-custom-field-options", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.option;
}

export async function deletePlanningCustomFieldOption(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/planning-custom-field-options", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function fetchPlanningCustomFieldValues(
  target: {
    planningItemId?: number | null;
    executionSegmentId?: number | null;
    activityGroupId?: string | null;
  },
  accessToken?: string
) {
  const params = new URLSearchParams();
  if (target.planningItemId) params.set("planning_item_id", String(target.planningItemId));
  if (target.executionSegmentId) params.set("execution_segment_id", String(target.executionSegmentId));
  if (target.activityGroupId) params.set("activity_group_id", target.activityGroupId);

  const json = await requestJson<{ values?: PlanningCustomFieldValueDto[] }>(
    `/api/planning-custom-field-values?${params.toString()}`,
    { accessToken }
  );
  return Array.isArray(json.values) ? json.values : [];
}

export async function fetchPlanningCustomFieldValuesForItems(
  planningItemIds: number[],
  accessToken?: string
) {
  const ids = [...new Set(planningItemIds.filter((id) => Number.isFinite(id) && id > 0))];

  if (!ids.length) {
    return [];
  }

  const params = new URLSearchParams({ planning_item_ids: ids.join(",") });
  const json = await requestJson<{ values?: PlanningCustomFieldValueDto[] }>(
    `/api/planning-custom-field-values?${params.toString()}`,
    { accessToken }
  );
  return Array.isArray(json.values) ? json.values : [];
}

export async function savePlanningCustomFieldValues(
  payload: PlanningCustomFieldValuesSaveRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ values?: PlanningCustomFieldValueDto[] }>("/api/planning-custom-field-values", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return Array.isArray(json.values) ? json.values : [];
}
