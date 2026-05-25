"use client";

import { supabaseAuth } from "@/lib/authClient";
import { recordOperationalEvent } from "../../../lib/observability/logger";

export type PlanningRealtimeSubscription = {
  unsubscribe: () => void;
};

type SubscribePlanningRealtimeArgs = {
  selectedDate: string;
  accessToken: string;
  onChange: () => void;
};

export function subscribePlanningRealtimeChanges({
  selectedDate,
  accessToken,
  onChange,
}: SubscribePlanningRealtimeArgs): PlanningRealtimeSubscription {
  const realtimeClient = supabaseAuth;

  realtimeClient.realtime.setAuth(accessToken);
  recordOperationalEvent({
    name: "realtime.subscription_started",
    source: "planningRealtime",
    metadata: { selectedDate },
  });

  const channel = realtimeClient
    .channel(`planning-items-${selectedDate}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "planning_items",
        filter: `item_date=eq.${selectedDate}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "planning_items",
        filter: `item_date=eq.${selectedDate}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "planning_items",
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "activity_execution_segments",
        filter: `item_date=eq.${selectedDate}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "activity_execution_segments",
        filter: `item_date=eq.${selectedDate}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "activity_execution_segments",
      },
      onChange
    )
    .subscribe((status) => {
      recordOperationalEvent({
        level: status === "SUBSCRIBED" ? "info" : "warn",
        name: "realtime.subscription_status",
        source: "planningRealtime",
        metadata: { selectedDate, status },
      });
    });

  return {
    unsubscribe: () => {
      recordOperationalEvent({
        name: "realtime.subscription_stopped",
        source: "planningRealtime",
        metadata: { selectedDate },
      });
      void realtimeClient.removeChannel(channel);
    },
  };
}
