# Integration Adapters

Provider adapters will live here once they are needed. Examples:

- `resend/` for email delivery.
- `slack/` or `discord/` for team notifications.
- `whatsapp/` for operational messaging.
- `power-bi/`, `sharepoint/` or `erp/` for exports and enterprise systems.
- `industrial-telemetry/` for IoT or plant-event ingestion.

Adapters must implement contracts from `src/integrations` and avoid importing UI
or domain presentation code.
