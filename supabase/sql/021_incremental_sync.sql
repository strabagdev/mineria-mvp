-- Incremental sync foundation for local-first planning.

create table if not exists public.sync_changes (
  sequence_id bigserial primary key,
  scope_user_id uuid null references auth.users(id) on delete cascade,
  domain text not null,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  server_revision text null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  mutation_id text null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  constraint sync_changes_domain_not_empty check (btrim(domain) <> ''),
  constraint sync_changes_entity_type_not_empty check (btrim(entity_type) <> ''),
  constraint sync_changes_entity_id_not_empty check (btrim(entity_id) <> '')
);

create index if not exists sync_changes_scope_sequence_idx
  on public.sync_changes (scope_user_id, sequence_id);

create index if not exists sync_changes_domain_sequence_idx
  on public.sync_changes (domain, sequence_id);

create index if not exists sync_changes_entity_idx
  on public.sync_changes (domain, entity_type, entity_id, sequence_id);

create unique index if not exists sync_changes_mutation_entity_uidx
  on public.sync_changes (mutation_id, domain, entity_type, entity_id, operation)
  where mutation_id is not null;

create table if not exists public.sync_processed_mutations (
  id bigserial primary key,
  mutation_id text not null,
  scope_user_id uuid null references auth.users(id) on delete cascade,
  domain text not null,
  operation text not null,
  entity_type text null,
  entity_id text null,
  server_revision text null,
  response jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  constraint sync_processed_mutations_mutation_id_not_empty check (btrim(mutation_id) <> ''),
  constraint sync_processed_mutations_domain_not_empty check (btrim(domain) <> ''),
  constraint sync_processed_mutations_operation_not_empty check (btrim(operation) <> '')
);

create unique index if not exists sync_processed_mutations_scope_mutation_uidx
  on public.sync_processed_mutations (coalesce(scope_user_id, '00000000-0000-0000-0000-000000000000'::uuid), domain, mutation_id);

create index if not exists sync_processed_mutations_actor_idx
  on public.sync_processed_mutations (actor_user_id, processed_at desc);
