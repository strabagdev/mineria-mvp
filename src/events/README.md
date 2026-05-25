# Internal Events

This directory defines an in-process event bus foundation. It is intentionally
small: no Kafka, NATS, RabbitMQ, persistence, distributed workers or endpoint
changes.

## Potential Events

| Event | Future consumers |
| --- | --- |
| `planning.item_created` | Audit, realtime invalidation, reporting cache, notifications |
| `planning.item_updated` | Audit, realtime invalidation, reporting cache |
| `planning.item_deleted` | Audit, realtime invalidation, reporting cache |
| `sync.replay_completed` | Observability, jobs, notifications |
| `sync.conflict_detected` | Observability, message center, notifications |
| `report.generated` | Observability, export jobs, audit |
| `auth.session_changed` | Observability, security audit |
| `notification.requested` | Notification providers, jobs |
| `integration.delivery_failed` | Retry jobs, observability |
| `cache.invalidated` | Local cache, reporting snapshots |
| `offline.snapshot_refreshed` | Observability, freshness indicators |

## Event Model

Events include:

- `name`
- typed `payload`
- `metadata.sourceModule`
- optional `correlationId`
- optional `causationId`
- optional `idempotencyKey`
- optional actor/org/site scope
- generated `id`
- generated `timestamp`

## Bus Behavior

- In-process only.
- Sequential handler execution.
- Handler errors are captured and reported in the publish result.
- A failing handler does not stop later handlers.
- Publishing emits observability events through `event_bus.published` and
  `event_bus.handler_failed`.
- Nothing is persisted and nothing crosses process boundaries.

## Rules

- Events do not replace critical transactional logic.
- Do not use events for synchronous flows where the caller must know the outcome
  before returning a response.
- Handlers must be idempotent before writing data, sending notifications or
  triggering integrations.
- Keep handlers explicit and registered near their owning module/runtime.
- Avoid hidden side effects in page components.
- Avoid circular dependencies between modules.
- Do not publish sensitive payloads, tokens, secrets or large records.
- Prefer small payloads with identifiers and let handlers load canonical data if
  needed.

## What Should Not Use The Event Bus Yet

- Auth/session correctness.
- Database writes that must be in the same transaction as the request.
- Offline sync conflict resolution.
- Security authorization decisions.
- Realtime delivery guarantees.
- External integration retries that require persistence.
- Long-running jobs that must survive process restarts.

## Future Integration

- Jobs: events can enqueue jobs once a persistent queue exists.
- Observability: every publish and failure is recorded locally today.
- Integrations: outbound notifications/webhooks can subscribe later through
  provider-neutral contracts.
- Audit: audit can consume domain events only after transaction boundaries are
  clear.
- Realtime: event-driven invalidation can be explored after existing realtime
  behavior is preserved.
- Multi-tenant/faena: metadata must include org/site scope before events affect
  shared data or external delivery.
