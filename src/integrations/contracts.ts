export type IntegrationKind =
  | "auth-provider"
  | "database-provider"
  | "file-provider"
  | "inbound-webhook"
  | "notification-channel"
  | "outbound-webhook"
  | "reporting-export"
  | "scheduled-job"
  | "telemetry-stream";

export type IntegrationRuntime = "server" | "client" | "edge" | "worker";

export type IntegrationSeverity = "info" | "warn" | "error";

export type IntegrationContext = {
  correlationId?: string;
  idempotencyKey?: string;
  actorId?: string;
  organizationId?: string;
  siteId?: string;
  source?: string;
};

export type IntegrationError = {
  code: string;
  message: string;
  severity: IntegrationSeverity;
  retryable: boolean;
  provider?: string;
};

export type IntegrationSuccess<T = void> = {
  ok: true;
  provider: string;
  value: T;
};

export type IntegrationFailure = {
  ok: false;
  provider: string;
  error: IntegrationError;
};

export type IntegrationResult<T = void> = IntegrationSuccess<T> | IntegrationFailure;

export type IntegrationAdapterDescriptor = {
  id: string;
  label: string;
  kind: IntegrationKind;
  runtime: IntegrationRuntime;
  enabled: boolean;
};

export function buildIntegrationIdempotencyKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts
    .filter((part): part is string | number | boolean => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).trim().toLowerCase())
    .filter(Boolean)
    .join(":");
}

export function isIntegrationSuccess<T>(result: IntegrationResult<T>): result is IntegrationSuccess<T> {
  return result.ok;
}
