export type ObservabilityLevel = "info" | "warn" | "error";

export type OperationalEventName =
  | "network.status_changed"
  | "network.heartbeat"
  | "network.request_failed"
  | "auth.session_recovery_started"
  | "auth.session_recovery_finished"
  | "auth.session_recovery_failed"
  | "auth.profile_sync_failed"
  | "auth.offline_profile_used"
  | "realtime.subscription_started"
  | "realtime.subscription_status"
  | "realtime.subscription_stopped"
  | "realtime.refresh_deferred"
  | "realtime.refresh_failed"
  | "offline.cache_used"
  | "offline.cache_miss"
  | "offline.snapshot_saved"
  | "planning_custom_fields.load_failed"
  | "planning_custom_field_values.load_failed"
  | "planning_custom_field_values.save_failed"
  | "indexeddb.transaction_failed"
  | "sync.queue_loaded"
  | "sync.queue_persisted"
  | "sync.legacy_queue_migrated"
  | "sync.replay_started"
  | "sync.replay_finished"
  | "sync.replay_failed"
  | "sync.conflict_detected"
  | "refresh.failed"
  | "job.started"
  | "job.succeeded"
  | "job.failed"
  | "job.retry_scheduled"
  | "job.skipped"
  | "event_bus.published"
  | "event_bus.handler_failed";

export type OperationalEventMetadata = Record<string, string | number | boolean | null | undefined>;

export type OperationalEvent = {
  id: string;
  timestamp: string;
  level: ObservabilityLevel;
  name: OperationalEventName;
  source: string;
  metadata?: OperationalEventMetadata;
};
