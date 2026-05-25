import { recordOperationalEvent } from "../lib/observability/logger";
import type {
  InternalEvent,
  InternalEventHandler,
  InternalEventName,
  PublishInternalEventInput,
  PublishInternalEventResult,
} from "./contracts";

export type EventUnsubscribe = () => void;

let eventSequence = 0;

function createEventId() {
  eventSequence += 1;
  return `evt-${Date.now()}-${eventSequence}`;
}

export class InProcessEventBus {
  private readonly handlers = new Map<InternalEventName, Set<InternalEventHandler>>();

  subscribe<TName extends InternalEventName>(name: TName, handler: InternalEventHandler<TName>): EventUnsubscribe {
    const handlersForName = this.handlers.get(name) ?? new Set<InternalEventHandler>();
    handlersForName.add(handler as InternalEventHandler);
    this.handlers.set(name, handlersForName);

    return () => {
      handlersForName.delete(handler as InternalEventHandler);
      if (handlersForName.size === 0) {
        this.handlers.delete(name);
      }
    };
  }

  async publish<TName extends InternalEventName>(
    input: PublishInternalEventInput<TName>
  ): Promise<PublishInternalEventResult<TName>> {
    const event: InternalEvent<TName> = {
      id: createEventId(),
      name: input.name,
      payload: input.payload,
      metadata: input.metadata,
      timestamp: new Date().toISOString(),
    };
    const handlers = [...(this.handlers.get(input.name) ?? [])];
    const failures: PublishInternalEventResult<TName>["failures"] = [];

    recordOperationalEvent({
      name: "event_bus.published",
      source: "eventBus",
      metadata: {
        eventName: input.name,
        handlerCount: handlers.length,
        correlationId: input.metadata.correlationId,
        sourceModule: input.metadata.sourceModule,
      },
    });

    for (const [handlerIndex, handler] of handlers.entries()) {
      try {
        await handler(event);
      } catch (error) {
        failures.push({ handlerIndex, error });
        recordOperationalEvent({
          level: "warn",
          name: "event_bus.handler_failed",
          source: "eventBus",
          metadata: {
            eventName: input.name,
            handlerIndex,
            correlationId: input.metadata.correlationId,
            sourceModule: input.metadata.sourceModule,
          },
        });
      }
    }

    return {
      event,
      handlerCount: handlers.length,
      failures,
    };
  }

  clear() {
    this.handlers.clear();
  }
}

export const internalEventBus = new InProcessEventBus();
