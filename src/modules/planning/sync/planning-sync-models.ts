import type { PlanningAssignmentInputDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import type { OfflineStorageScope } from "@/lib/localOfflineStore";
import type { SyncFailureReason, SyncMutationStatus } from "@/modules/sync/sync-contracts";

export type PlanningMutationStatus = SyncMutationStatus;
export type PlanningMutationFailureReason = SyncFailureReason;

export type PlanningMutationConflictSnapshot = {
  serverItem?: unknown;
  localPayload?: Record<string, unknown>;
};

export type PendingPlanningMutation = {
  id: string;
  userId: string;
  scope: OfflineStorageScope;
  method: "POST" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  assignmentPayload?: PlanningAssignmentInputDto[];
  syncedPlanningItemId?: number;
  createdAt: string;
  updatedAt?: string;
  status: PlanningMutationStatus;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  failureReason?: PlanningMutationFailureReason;
  conflictSnapshot?: PlanningMutationConflictSnapshot;
};

export const LEGACY_PLANNING_MUTATION_QUEUE_KEY = "mineria.pendingPlanningMutations.v1";
export const PENDING_SYNC_RETRY_INTERVAL_MS = 30_000;
export const INCREMENTAL_SYNC_INTERVAL_MS = 10_000;
export const MAX_PLANNING_SYNC_ATTEMPTS = 8;
