import type { IntegrationContext, IntegrationResult } from "../contracts";

export type NotificationChannel = "email" | "slack" | "discord" | "whatsapp" | "webhook";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationRecipient = {
  channel: NotificationChannel;
  address: string;
  label?: string;
};

export type NotificationMessage = {
  subject: string;
  body: string;
  priority: NotificationPriority;
  recipients: NotificationRecipient[];
  tags?: string[];
};

export type NotificationDeliveryReceipt = {
  providerMessageId?: string;
  acceptedAt: string;
};

export type NotificationProvider = {
  readonly id: string;
  readonly channel: NotificationChannel;
  send(message: NotificationMessage, context?: IntegrationContext): Promise<IntegrationResult<NotificationDeliveryReceipt>>;
};
