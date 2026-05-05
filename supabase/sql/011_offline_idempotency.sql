alter table if exists planning_items
  add column if not exists client_mutation_id text;

alter table if exists activity_execution_segments
  add column if not exists client_mutation_id text;

create unique index if not exists planning_items_client_mutation_id_uidx
  on planning_items (client_mutation_id)
  where client_mutation_id is not null;

create index if not exists activity_execution_segments_client_mutation_id_idx
  on activity_execution_segments (client_mutation_id)
  where client_mutation_id is not null;
