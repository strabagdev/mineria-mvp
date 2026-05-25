# Background Jobs

This directory prepares the internal boundary for background jobs and workers.
It does not introduce a queue, cron runtime, external worker or real job yet.

## Inventory Of Future Jobs

| Job family | Examples | Current status |
| --- | --- | --- |
| Scheduled reports | Daily/weekly operational reports, dashboard digests | Planned |
| Notifications | Email, Slack, WhatsApp or webhook alerts | Planned through `src/integrations` |
| Heavy exports | Power BI, Excel, CSV, SharePoint exports | Planned through reporting/integrations |
| Imports | Excel/CSV load, ERP handoff ingestion | Planned |
| Offline cleanup | Snapshot TTL, stale cache cleanup, legacy key migration | Planned |
| Integration retries | Outbound webhook or notification retry | Planned |
| Server-side sync | Future canonical replay or reconciliation | Planned |
| Aggregations | Precomputed reporting metrics by shift/faena | Planned |
| Audit/housekeeping | Retention, consistency checks, stale access requests | Planned |

## Base Contracts

`contracts.ts` defines:

- `JobDefinition`
- `JobContext`
- `JobResult`
- `JobError`
- `JobRetryPolicy`
- `JobScheduleMetadata`
- idempotency and retry helpers

These contracts are provider-neutral. A job can later run from a script, a Next
route, a cron trigger or a dedicated worker without changing the domain service
it calls.

## Execution Strategy

### Stage 1: Current Foundation

- Manual scripts or explicit server calls only.
- No persistent queue.
- No deployment changes.
- Use contracts and idempotency keys before adding real execution.

### Stage 2: Simple Cron

- Railway cron or Vercel cron can trigger a protected route or script.
- Cron handlers should stay thin and call job definitions/application services.
- Authentication/authorization for cron triggers must be documented before use.

### Stage 3: Persistent Queue

- Add durable storage for job runs, attempts, locks and idempotency keys.
- Add retry backoff, dead-letter handling and rate limits per provider/tenant.
- Keep provider adapters behind `src/integrations`.

### Stage 4: Dedicated Worker Service

- Split a worker process only when runtime duration, concurrency or deployment
  isolation requires it.
- The worker should import domain/application services, not UI components.

## Rules

- Jobs must not import UI or React components.
- Jobs should call services, repositories or module application layers.
- Jobs must be idempotent before they write, send notifications or call external
  providers.
- Jobs must emit operational events such as `job.started`, `job.succeeded`,
  `job.failed`, `job.retry_scheduled` or `job.skipped` when execution exists.
- Jobs must use structured errors and distinguish retryable from non-retryable
  failures.
- Jobs must not duplicate domain logic that already lives in modules/services.
- Jobs that touch integrations must use `src/integrations` contracts/adapters.
- Jobs that become tenant/faena-aware must include org/site context in
  `JobContext` and idempotency keys.

## Observability

The observability event vocabulary now reserves:

- `job.started`
- `job.succeeded`
- `job.failed`
- `job.retry_scheduled`
- `job.skipped`

No runtime instrumentation is active yet because no real jobs were introduced.

## Integration Points

- Observability: jobs emit structured operational events without secrets.
- Integrations: notifications, exports and webhooks use provider-neutral
  contracts from `src/integrations`.
- Reporting: scheduled reports and heavy exports should consume reporting DTOs
  and helpers, not page state.
- Offline cleanup: cache cleanup must preserve current keys until a formal
  migration/TTL policy exists.
- Multi-tenant/faena: future jobs must scope idempotency, locks and rate limits
  by organization/site/faena before touching shared data.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cron endpoint exposed | Unauthorized execution | Protected triggers and audit logs. |
| Non-idempotent retries | Duplicate notifications, exports or writes | Stable idempotency keys and persisted attempts. |
| Long jobs in request runtime | Timeouts and partial execution | Move to persistent queue or worker stage. |
| Duplicate domain logic | Drift from UI/API behavior | Call application/services only. |
| No locking | Concurrent job overlap | Add locks before enabling scheduled writes. |
| Secret leakage | Tokens in logs or client bundles | Server-only env and sanitized observability. |
| Tenant/faena mixing | Cross-site data leakage | Scope context, keys, locks and storage. |

## Current Non-Goals

- No microservices.
- No external queues.
- No new dependencies.
- No endpoint, auth, deployment or UI changes.
- No real background job execution.
