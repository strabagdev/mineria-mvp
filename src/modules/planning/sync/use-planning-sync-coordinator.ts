"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OfflineStorageScope } from "@/lib/localOfflineStore";
import { isBrowserOffline, subscribeNetworkStatus } from "@/lib/networkStatus";
import {
  discardConflictedPlanningMutations as discardConflictedPlanningMutationQueue,
} from "./planning-mutation-queue";
import {
  loadPendingPlanningMutations,
  persistPendingPlanningMutations,
} from "./planning-mutation-queue-store";
import {
  PlanningSyncCoordinator,
  type PlanningSyncCoordinatorReplayHandlers,
} from "./planning-sync-coordinator";
import {
  PENDING_SYNC_RETRY_INTERVAL_MS,
  type PendingPlanningMutation,
} from "./planning-sync-models";

type UsePlanningSyncCoordinatorArgs = Omit<PlanningSyncCoordinatorReplayHandlers, "onQueueUpdated"> & {
  scope: OfflineStorageScope | null;
  accessToken?: string;
  canSync: boolean;
};

type LatestPlanningSyncCoordinatorArgs = UsePlanningSyncCoordinatorArgs;

export function usePlanningSyncCoordinator(args: UsePlanningSyncCoordinatorArgs) {
  const [pendingPlanningMutations, setPendingPlanningMutations] = useState<PendingPlanningMutation[]>([]);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const pendingPlanningMutationsRef = useRef<PendingPlanningMutation[]>([]);
  const latestArgsRef = useRef<LatestPlanningSyncCoordinatorArgs>(args);
  const coordinatorRef = useRef<PlanningSyncCoordinator | null>(null);

  useEffect(() => {
    latestArgsRef.current = args;
  }, [args]);

  useEffect(() => {
    pendingPlanningMutationsRef.current = pendingPlanningMutations;
  }, [pendingPlanningMutations]);

  useEffect(() => {
    let active = true;

    async function loadOutbox() {
      if (!args.scope) {
        if (active) {
          setPendingPlanningMutations([]);
        }
        return;
      }

      const mutations = await loadPendingPlanningMutations(args.scope);

      if (active) {
        setPendingPlanningMutations(mutations.filter((mutation) => mutation.userId === args.scope?.userId));
      }
    }

    void loadOutbox();

    return () => {
      active = false;
    };
  }, [args.scope]);

  useEffect(() => {
    if (!args.scope) {
      return;
    }

    void persistPendingPlanningMutations(pendingPlanningMutations, args.scope);
  }, [args.scope, pendingPlanningMutations]);

  const syncPendingPlanningMutations = useCallback(async () => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = new PlanningSyncCoordinator({
        getMutations: () => pendingPlanningMutationsRef.current,
        getScopeUserId: () => latestArgsRef.current.scope?.userId ?? null,
        getAccessToken: () => latestArgsRef.current.accessToken,
        canSync: () => latestArgsRef.current.canSync,
        isOffline: isBrowserOffline,
        sendMutation: (mutation) => latestArgsRef.current.sendMutation(mutation),
        replayAssignmentPayload: (mutation, response) =>
          latestArgsRef.current.replayAssignmentPayload?.(mutation, response) ?? Promise.resolve(),
        getErrorMessage: (error) => latestArgsRef.current.getErrorMessage(error),
        classifyError: (error) => latestArgsRef.current.classifyError(error),
        loadServerConflictSnapshot: (mutation) =>
          latestArgsRef.current.loadServerConflictSnapshot?.(mutation) ?? Promise.resolve(null),
        onQueueUpdated: setPendingPlanningMutations,
        onReplayResult: (result) => latestArgsRef.current.onReplayResult?.(result),
        setSyncing: setQueueSyncing,
      });
    }

    await coordinatorRef.current.processPendingMutations();
  }, []);

  useEffect(() => {
    function syncWhenOnline() {
      void syncPendingPlanningMutations();
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") {
        void syncPendingPlanningMutations();
      }
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(syncWhenOnline);
    const retryInterval = window.setInterval(syncWhenOnline, PENDING_SYNC_RETRY_INTERVAL_MS);
    window.addEventListener("focus", syncWhenOnline);
    window.addEventListener("online", syncWhenOnline);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      unsubscribeNetworkStatus();
      window.clearInterval(retryInterval);
      window.removeEventListener("focus", syncWhenOnline);
      window.removeEventListener("online", syncWhenOnline);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [syncPendingPlanningMutations]);

  useEffect(() => {
    void syncPendingPlanningMutations();
  }, [pendingPlanningMutations, args.accessToken, args.canSync, syncPendingPlanningMutations]);

  const discardConflictedPlanningMutations = useCallback(() => {
    setPendingPlanningMutations(discardConflictedPlanningMutationQueue);
  }, []);

  const retryFailedPlanningMutations = useCallback(() => {
    setPendingPlanningMutations((current) =>
      current.map((mutation) =>
        mutation.status === "failed" &&
        mutation.failureReason !== "permission_revoked" &&
        mutation.failureReason !== "validation"
          ? {
              ...mutation,
              status: "pending",
              failureReason: undefined,
              nextRetryAt: undefined,
            }
          : mutation
      )
    );
  }, []);

  return {
    pendingPlanningMutations,
    setPendingPlanningMutations,
    queueSyncing,
    syncPendingPlanningMutations,
    discardConflictedPlanningMutations,
    retryFailedPlanningMutations,
  };
}
