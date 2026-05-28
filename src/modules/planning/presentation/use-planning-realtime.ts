"use client";

import { useEffect, useRef } from "react";
import { isBrowserOffline, type OperationalStatus } from "@/lib/networkStatus";
import { recordOperationalEvent } from "../../../lib/observability/logger";
import { subscribePlanningRealtimeChanges } from "@/modules/planning/realtime/planning-realtime-adapter";

type UsePlanningRealtimeArgs = {
  selectedDate: string;
  accessToken?: string;
  networkStatus: OperationalStatus;
  onInvalidate: () => void;
};

export function usePlanningRealtime({
  selectedDate,
  accessToken,
  networkStatus,
  onInvalidate,
}: UsePlanningRealtimeArgs) {
  const pendingRealtimeRefreshRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!accessToken || networkStatus !== "online" || isBrowserOffline()) {
      return;
    }

    function scheduleRealtimeRefresh() {
      if (document.visibilityState === "hidden" || isBrowserOffline()) {
        pendingRealtimeRefreshRef.current = true;
        recordOperationalEvent({
          name: "realtime.refresh_deferred",
          source: "usePlanningRealtime",
          metadata: {
            selectedDate,
            hidden: document.visibilityState === "hidden",
          },
        });
        return;
      }

      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        if (isBrowserOffline()) {
          return;
        }
        onInvalidate();
      }, 350);
    }

    function refreshDeferredRealtimeChanges() {
      if (!pendingRealtimeRefreshRef.current || document.visibilityState === "hidden") {
        return;
      }

      pendingRealtimeRefreshRef.current = false;
      scheduleRealtimeRefresh();
    }

    const subscription = subscribePlanningRealtimeChanges({
      selectedDate,
      accessToken,
      onChange: scheduleRealtimeRefresh,
    });

    document.addEventListener("visibilitychange", refreshDeferredRealtimeChanges);
    window.addEventListener("focus", refreshDeferredRealtimeChanges);

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      document.removeEventListener("visibilitychange", refreshDeferredRealtimeChanges);
      window.removeEventListener("focus", refreshDeferredRealtimeChanges);
      subscription.unsubscribe();
    };
  }, [accessToken, networkStatus, onInvalidate, selectedDate]);
}
