import { getRetryablePlanningMutations, replayPendingPlanningMutations } from "./planning-mutation-queue";
import type {
  PendingPlanningMutation,
  PlanningMutationFailureReason,
} from "./planning-sync-models";

export type PlanningSyncCoordinatorReplayHandlers = {
  sendMutation: (mutation: PendingPlanningMutation) => Promise<unknown>;
  pullRemoteChanges?: (mutations: PendingPlanningMutation[]) => Promise<PendingPlanningMutation[] | void>;
  replayAssignmentPayload?: (mutation: PendingPlanningMutation, response: unknown) => Promise<void>;
  getErrorMessage: (error: unknown) => string;
  classifyError: (error: unknown) => PlanningMutationFailureReason;
  loadServerConflictSnapshot?: (mutation: PendingPlanningMutation) => Promise<unknown>;
  onQueueUpdated: (mutations: PendingPlanningMutation[]) => void;
  onReplayResult?: (result: Awaited<ReturnType<typeof replayPendingPlanningMutations>>) => Promise<void> | void;
};

export type PlanningSyncCoordinatorInput = PlanningSyncCoordinatorReplayHandlers & {
  getMutations: () => PendingPlanningMutation[];
  getScopeUserId: () => string | null;
  getAccessToken: () => string | undefined;
  canSync: () => boolean;
  isOffline: () => boolean;
  setSyncing?: (syncing: boolean) => void;
};

export class PlanningSyncCoordinator {
  private syncInFlight = false;

  constructor(private readonly input: PlanningSyncCoordinatorInput) {}

  async processPendingMutations() {
    const scopeUserId = this.input.getScopeUserId();

    if (!this.input.canSync() || !scopeUserId || !this.input.getAccessToken()) {
      return;
    }

    if (this.syncInFlight || this.input.isOffline()) {
      return;
    }

    const scopedMutations = this.input.getMutations().filter((mutation) => mutation.userId === scopeUserId);
    const retryableMutations = getRetryablePlanningMutations(scopedMutations);

    if (!retryableMutations.length && !this.input.pullRemoteChanges) {
      return;
    }

    this.syncInFlight = true;
    this.input.setSyncing?.(true);

    try {
      let queueForPull = scopedMutations;

      if (retryableMutations.length) {
        const replayResult = await replayPendingPlanningMutations({
          mutations: scopedMutations,
          sendMutation: this.input.sendMutation,
          replayAssignmentPayload: this.input.replayAssignmentPayload,
          getErrorMessage: this.input.getErrorMessage,
          classifyError: this.input.classifyError,
          loadServerConflictSnapshot: this.input.loadServerConflictSnapshot,
        });

        this.input.onQueueUpdated(replayResult.nextQueue);
        await this.input.onReplayResult?.(replayResult);
        queueForPull = replayResult.nextQueue;
      }

      const queueAfterPull = await this.input.pullRemoteChanges?.(queueForPull);
      if (queueAfterPull) {
        this.input.onQueueUpdated(queueAfterPull);
      }
    } finally {
      this.syncInFlight = false;
      this.input.setSyncing?.(false);
    }
  }
}
