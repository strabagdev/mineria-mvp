import { assertBrowserOnline } from "@/lib/networkStatus";
import type {
  OperationalHeaderDependencyCreateRequestDto,
  OperationalHeaderFieldCreateRequestDto,
  OperationalHeaderFieldDto,
  OperationalHeaderFieldUpdateRequestDto,
  OperationalHeaderFieldOptionDto,
  OperationalHeaderOptionDependencyDto,
  OperationalHeaderOptionCreateRequestDto,
  OperationalHeaderOptionUpdateRequestDto,
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";

async function requestJson<T>(path: string, input: RequestInit & { accessToken?: string } = {}) {
  assertBrowserOnline();

  if (!input.accessToken) {
    throw new Error("Necesitas iniciar sesion para administrar la cabecera operacional.");
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
    throw new Error(String(json.error ?? "No se pudo cargar la cabecera operacional."));
  }

  return json as T;
}

export async function fetchOperationalHeaderConfig(
  accessToken?: string,
  input: { activeOnly?: boolean } = {}
) {
  const active = input.activeOnly === false ? "false" : "true";
  const json = await requestJson<Partial<OperationalHeaderResponseDto>>(
    `/api/operational-header?active=${active}`,
    { accessToken }
  );
  const payload = json as Partial<OperationalHeaderResponseDto>;

  return {
    fields: Array.isArray(payload.fields) ? payload.fields : [],
    dependencies: Array.isArray(payload.dependencies) ? payload.dependencies : [],
  } satisfies OperationalHeaderResponseDto;
}

export async function createOperationalHeaderField(
  payload: OperationalHeaderFieldCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ field: OperationalHeaderFieldDto }>("/api/operational-header", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function updateOperationalHeaderField(
  payload: OperationalHeaderFieldUpdateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ field: OperationalHeaderFieldDto }>("/api/operational-header", {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });
  return json.field;
}

export async function deleteOperationalHeaderField(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/operational-header", {
    method: "DELETE",
    body: JSON.stringify({ id }),
    accessToken,
  });
}

export async function createOperationalHeaderOption(
  payload: OperationalHeaderOptionCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: OperationalHeaderFieldOptionDto }>("/api/operational-header", {
    method: "POST",
    body: JSON.stringify({ ...payload, entity: "option" }),
    accessToken,
  });
  return json.option;
}

export async function updateOperationalHeaderOption(
  payload: OperationalHeaderOptionUpdateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ option: OperationalHeaderFieldOptionDto }>("/api/operational-header", {
    method: "PATCH",
    body: JSON.stringify({ ...payload, entity: "option" }),
    accessToken,
  });
  return json.option;
}

export async function deleteOperationalHeaderOption(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/operational-header", {
    method: "DELETE",
    body: JSON.stringify({ entity: "option", id }),
    accessToken,
  });
}

export async function createOperationalHeaderDependency(
  payload: OperationalHeaderDependencyCreateRequestDto,
  accessToken?: string
) {
  const json = await requestJson<{ dependency: OperationalHeaderOptionDependencyDto }>("/api/operational-header", {
    method: "POST",
    body: JSON.stringify({ ...payload, entity: "dependency" }),
    accessToken,
  });
  return json.dependency;
}

export async function deleteOperationalHeaderDependency(id: number, accessToken?: string) {
  return requestJson<{ deleted: boolean }>("/api/operational-header", {
    method: "DELETE",
    body: JSON.stringify({ entity: "dependency", id }),
    accessToken,
  });
}
