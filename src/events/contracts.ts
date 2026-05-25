export type InternalEventName =
  | "planning.item_created"
  | "planning.item_updated"
  | "planning.item_deleted"
  | "sync.replay_completed"
  | "sync.conflict_detected"
  | "report.generated"
  | "auth.session_changed"
  | "notification.requested"
  | "integration.delivery_failed"
  | "cache.invalidated"
  | "offline.snapshot_refreshed"
  | "debug.event_published";

export type InternalEventMetadata = {
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  sourceModule: string;
  actorId?: string;
  organizationId?: string;
  siteId?: string;
};

export type InternalEventPayloadMap = {
  "planning.item_created": { itemId: number; activityGroupId: string; itemDate: string };
  "planning.item_updated": { itemId: number; activityGroupId: string; itemDate: string };
  "planning.item_deleted": { itemId: number; activityGroupId?: string; itemDate?: string };
  "sync.replay_completed": { replayedCount: number; conflictedCount: number };
  "sync.conflict_detected": { mutationId?: string; reason: string };
  "report.generated": { dateFrom: string; dateTo: string; rowCount: number };
  "auth.session_changed": { status: "signed-in" | "signed-out" | "expired" | "recovered" };
  "notification.requested": { channel: "email" | "slack" | "discord" | "whatsapp" | "webhook"; priority: string };
  "integration.delivery_failed": { provider: string; operation: string; retryable: boolean };
  "cache.invalidated": { dataset: string; scope?: string };
  "offline.snapshot_refreshed": { dataset: string; key: string };
  "debug.event_published": { message: string };
};

export type InternalEvent<TName extends InternalEventName = InternalEventName> = {
  id: string;
  name: TName;
  payload: InternalEventPayloadMap[TName];
  metadata: InternalEventMetadata;
  timestamp: string;
};

export type PublishInternalEventInput<TName extends InternalEventName = InternalEventName> = {
  name: TName;
  payload: InternalEventPayloadMap[TName];
  metadata: InternalEventMetadata;
};

export type InternalEventHandler<TName extends InternalEventName = InternalEventName> = (
  event: InternalEvent<TName>
) => void | Promise<void>;

export type EventHandlerFailure = {
  handlerIndex: number;
  error: unknown;
};

export type PublishInternalEventResult<TName extends InternalEventName = InternalEventName> = {
  event: InternalEvent<TName>;
  handlerCount: number;
  failures: EventHandlerFailure[];
};

export function buildInternalEventIdempotencyKey(
  eventName: InternalEventName,
  parts: Array<string | number | boolean | null | undefined>
) {
  return [eventName, ...parts]
    .filter((part): part is string | number | boolean => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).trim().toLowerCase())
    .filter(Boolean)
    .join(":");
}
