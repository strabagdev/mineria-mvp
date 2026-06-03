import type { AuditEventDto } from "@/modules/audit/contracts/audit";

const actionSummaries: Record<string, string> = {
  "activity_execution_segment.created": "Avance registrado",
  "activity_execution_segment.deleted": "Avance eliminado",
  "activity_execution_segment.updated": "Avance actualizado",
  "assignment_field.created": "Campo de asignación creado",
  "assignment_field.deleted": "Campo de asignación eliminado",
  "assignment_field.updated": "Campo de asignación modificado",
  "assignment_field_option.created": "Opción de asignación creada",
  "assignment_field_option.deleted": "Opción de asignación eliminada",
  "assignment_field_option.updated": "Opción de asignación modificada",
  "assignment_type.created": "Tipo de asignación creado",
  "assignment_type.deleted": "Tipo de asignación eliminado",
  "assignment_type.updated": "Tipo de asignación modificado",
  "catalog.detail.created": "Detalle de catalogo creado",
  "catalog.detail.deleted": "Detalle de catalogo eliminado",
  "catalog.detail.updated": "Detalle de catalogo actualizado",
  "planning_assignments.replaced": "Asignaciones actualizadas",
  "planning_custom_field.created": "Campo configurable creado",
  "planning_custom_field.deleted": "Campo configurable eliminado",
  "planning_custom_field.updated": "Campo configurable modificado",
  "planning_custom_field_option.created": "Opción de campo configurable creada",
  "planning_custom_field_option.deleted": "Opción de campo configurable eliminada",
  "planning_custom_field_option.updated": "Opción de campo configurable modificada",
  "planning_custom_field_values.saved": "Datos adicionales actualizados",
  "planning_item.created": "Programación creada",
  "planning_item.deleted": "Programación eliminada",
  "planning_item.updated": "Programación modificada",
  "user.active_toggled": "Estado de usuario actualizado",
  "user.approval_status_updated": "Estado de aprobación actualizado",
  "user.created": "Usuario creado",
  "user.password_reset": "Contraseña restablecida",
  "user.role_updated": "Rol de usuario actualizado",
};

const fallbackVerbLabels: Record<string, string> = {
  created: "creado",
  deleted: "eliminado",
  replaced: "actualizado",
  saved: "guardado",
  updated: "modificado",
};

const jsonKeyLabels: Record<string, string> = {
  action: "Acción técnica",
  after: "Después",
  after_data: "Después",
  before: "Antes",
  before_data: "Antes",
  metadata: "Detalles del evento",
};

export function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatAuditEntity(entity: AuditEventDto["entity"]) {
  return entity.id ? `${entity.type} #${entity.id}` : entity.type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatSummaryKey(key: string) {
  const normalized = key.replace(/[-_]+/g, " ").trim();

  if (!normalized) {
    return key;
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function formatSummaryRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value);
  if (!entries.length) {
    return null;
  }

  return entries.map(([key, count]) => `${formatSummaryKey(key)}: ${count}`).join(" · ");
}

function formatFallbackActionLabel(action: string) {
  const parts = action.split(".").filter(Boolean);
  const verb = parts.at(-1) ?? action;
  const subject = parts.slice(0, -1).join(" ").replace(/[-_]+/g, " ").trim();
  const formattedSubject = formatSummaryKey(subject || action);
  const formattedVerb = fallbackVerbLabels[verb] ?? verb.replace(/[-_]+/g, " ");

  return `${formattedSubject} ${formattedVerb}`.trim();
}

export function getAuditActionLabel(event: AuditEventDto) {
  return actionSummaries[event.action] ?? formatFallbackActionLabel(event.action);
}

export function getAuditMetadataSummary(event: AuditEventDto) {
  return formatSummaryRecord(event.metadata?.summary);
}

export function getAuditEventSummary(event: AuditEventDto) {
  const summary = getAuditMetadataSummary(event);

  if (summary) {
    return summary;
  }

  return getAuditActionLabel(event);
}

export function formatJsonPreview(value: unknown) {
  if (value === null || value === undefined) {
    return "Sin datos";
  }

  if (Array.isArray(value) && value.length === 0) {
    return "Sin datos";
  }

  if (isRecord(value) && Object.keys(value).length === 0) {
    return "Sin datos";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(toHumanReadableAuditJson(value), null, 2);
}

export function toHumanReadableAuditJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toHumanReadableAuditJson);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      jsonKeyLabels[key] ?? key,
      toHumanReadableAuditJson(nestedValue),
    ])
  );
}
