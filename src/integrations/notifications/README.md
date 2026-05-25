# Notification Channels

Notification contracts are defined in `contracts.ts`. Concrete providers should
be added only when a real delivery channel is selected.

Target channels:

- Email, likely through Resend or another transactional provider.
- Slack or Discord for internal operational alerts.
- WhatsApp for field-facing operational messaging.
- Generic outbound webhooks for customer-owned automation.

Notification providers must not log message bodies, recipient secrets or tokens.
