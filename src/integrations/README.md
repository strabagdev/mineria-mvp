# Integrations

This boundary is reserved for external systems. It defines contracts and target
ownership only; no production integration is enabled here yet.

## Target Structure

- `contracts.ts`: provider-neutral integration result, context and adapter types.
- `notifications/`: email, Slack, Discord, WhatsApp and webhook notification
  contracts.
- `webhooks/`: inbound/outbound webhook handlers and verification contracts.
- `exports/`: Power BI, CSV, Excel, SharePoint and API export providers.
- `adapters/`: provider implementations such as Supabase, Resend, Slack or ERP
  connectors when they are introduced.

## Current Rule

Application code should depend on contracts or domain services, not directly on
new provider SDKs. Existing Supabase usage remains in its current auth/db/realtime
boundaries until a dedicated migration is planned.

## Provider Checklist

- Define a provider-neutral contract first.
- Keep secrets in server-only env handling.
- Include idempotency keys for inbound writes and outbound deliveries.
- Return structured `IntegrationResult` values instead of leaking SDK errors.
- Emit observability events without tokens, credentials or payloads with
  sensitive operational data.
- Document retry behavior and rate-limit assumptions before enabling production
  traffic.
