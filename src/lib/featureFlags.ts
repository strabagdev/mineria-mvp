export function isPlanningRealtimeEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_PLANNING_REALTIME !== "false";
}
