export type PendingPlanningMutation = {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  createdAt: string;
  status?: "pending" | "conflict";
  lastError?: string;
  lastTriedAt?: string;
};

export const LEGACY_PLANNING_MUTATION_QUEUE_KEY = "mineria.pendingPlanningMutations.v1";
export const PENDING_SYNC_RETRY_INTERVAL_MS = 30_000;
