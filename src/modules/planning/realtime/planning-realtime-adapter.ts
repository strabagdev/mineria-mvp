"use client";

import { supabaseAuth } from "@/lib/authClient";

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
    .subscribe();

  return {
    unsubscribe: () => {
      void realtimeClient.removeChannel(channel);
    },
  };
}
