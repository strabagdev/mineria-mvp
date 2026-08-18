import type { OfflineStorageScope } from "@/lib/localOfflineStore";

export type SyncScope = OfflineStorageScope;

export type SyncMutationOperation = "create" | "update" | "delete";

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

