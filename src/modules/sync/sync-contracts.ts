import type { OfflineStorageScope } from "@/lib/localOfflineStore";

export type SyncScope = OfflineStorageScope;

export type SyncMutationOperation = "create" | "update" | "delete";
export type SyncChangeOperation = "upsert" | "delete";

export type SyncMutationStatus = "pending" | "syncing" | "conflict" | "failed";

export type SyncFailureReason =
  | "network"
  | "auth"
  | "permission_revoked"
  | "concurrency_conflict"
  | "validation"
  | "unknown";

export type SyncMutation = {
  id: string;
  scope: SyncScope;
  entity: string;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
  status: SyncMutationStatus;
  attempts: number;
  createdAt: string;
  updatedAt?: string;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  failureReason?: SyncFailureReason;
};

export type SyncCoordinatorState = {
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  syncing: boolean;
};

export type SyncChange = {
  sequenceId: number;
  scopeUserId: string | null;
  domain: "planning";
  entityType: "planning_item" | "activity_execution_segment";
  entityId: string;
  operation: SyncChangeOperation;
  serverRevision: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  mutationId: string | null;
};

export type SyncPullResponse = {
  changes: SyncChange[];
  nextCursor: number;
  hasMore: boolean;
};

export type SyncPushMutation = {
  mutationId: string;
  domain: "planning";
  operation: SyncMutationOperation;
  entityId?: string | number | null;
  baseRevision?: string | null;
  payload: Record<string, unknown>;
};

export type SyncPushResponse = {
  results: Array<{
    mutationId: string;
    status: "applied" | "existing";
    response: unknown;
  }>;
};
