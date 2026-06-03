import type { AuditEventsQueryDto, AuditEventsResponseDto } from "@/modules/audit/contracts/audit";

function appendParam(params: URLSearchParams, key: keyof AuditEventsQueryDto, value: string | number | undefined) {
  if (value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

export async function fetchAuditEvents(input: {
  accessToken: string;
  query: AuditEventsQueryDto;
}) {
  const params = new URLSearchParams();

  appendParam(params, "from", input.query.from);
  appendParam(params, "to", input.query.to);
  appendParam(params, "action", input.query.action);
  appendParam(params, "entity_type", input.query.entity_type);
  appendParam(params, "entity_id", input.query.entity_id);
  appendParam(params, "user_id", input.query.user_id);
  appendParam(params, "limit", input.query.limit);
  appendParam(params, "cursor", input.query.cursor);

  const response = await fetch(`/api/audit-events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String((json as { error?: unknown }).error ?? "No se pudo cargar auditoria."));
  }

  return json as AuditEventsResponseDto;
}
