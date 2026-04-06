alter table planning_items
  add column if not exists activity_group_id text;

update planning_items
set activity_group_id = concat('legacy-', id)
where activity_group_id is null;

alter table planning_items
  alter column activity_group_id set not null;

alter table planning_items
  add column if not exists tracking_type text not null default 'programado'
  check (tracking_type in ('programado', 'real'));

create unique index if not exists planning_items_group_tracking_uidx
  on planning_items (activity_group_id, tracking_type);

create index if not exists planning_items_group_idx on planning_items (activity_group_id);
create index if not exists planning_items_tracking_idx on planning_items (tracking_type);
