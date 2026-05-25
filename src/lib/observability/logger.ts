import type {
  ObservabilityLevel,
  OperationalEvent,
  OperationalEventMetadata,
  OperationalEventName,
} from "./events";

const OPERATIONAL_EVENT_BUFFER_LIMIT = 150;
const operationalEvents: OperationalEvent[] = [];
let eventSequence = 0;

function sanitizeMetadata(metadata?: OperationalEventMetadata): OperationalEventMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (value === undefined) {
        return false;
      }

      return !/token|authorization|password|secret|email/i.test(key);
    })
  );
}

function shouldWriteConsole() {
  return process.env.NODE_ENV !== "production";
}

function writeConsole(event: OperationalEvent) {
  if (!shouldWriteConsole()) {
    return;
  }

  const payload = {
    id: event.id,
    source: event.source,
    metadata: event.metadata,
  };

  if (event.level === "error") {
    console.error(`[ops:${event.name}]`, payload);
    return;
  }

  if (event.level === "warn") {
    console.warn(`[ops:${event.name}]`, payload);
    return;
  }

  console.info(`[ops:${event.name}]`, payload);
}

export function recordOperationalEvent(input: {
  level?: ObservabilityLevel;
  name: OperationalEventName;
  source: string;
  metadata?: OperationalEventMetadata;
}) {
  eventSequence += 1;

  const event: OperationalEvent = {
    id: `op-${Date.now()}-${eventSequence}`,
    timestamp: new Date().toISOString(),
    level: input.level ?? "info",
    name: input.name,
    source: input.source,
    metadata: sanitizeMetadata(input.metadata),
  };

  operationalEvents.push(event);

  if (operationalEvents.length > OPERATIONAL_EVENT_BUFFER_LIMIT) {
    operationalEvents.splice(0, operationalEvents.length - OPERATIONAL_EVENT_BUFFER_LIMIT);
  }

  writeConsole(event);
  return event;
}

export function getOperationalEvents() {
  return [...operationalEvents];
}

export function clearOperationalEvents() {
  operationalEvents.length = 0;
}
