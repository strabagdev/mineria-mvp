export type AuditEventUserDto = {
  id: string | null;
  email: string | null;
};

export type AuditEventEntityDto = {
  type: string;
  id: string | null;
};

export type AuditEventDto = {
  id: number;
  created_at: string;
  user: AuditEventUserDto;
  action: string;
  entity: AuditEventEntityDto;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | null;
};

export type AuditEventsQueryDto = {
  from?: string;
  to?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  limit?: number;
  cursor?: string;
};

export type AuditEventsResponseDto = {
  events: AuditEventDto[];
  next_cursor: string | null;
};
