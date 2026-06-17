-- Incremental migration for target-aware planning assignments.
-- Safe to run after 007_planning_assignments.sql has already been applied.

alter table if exists planning_assignments
  add column if not exists execution_segment_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planning_assignments_execution_segment_id_fkey'
      and conrelid = 'public.planning_assignments'::regclass
  ) then
    alter table public.planning_assignments
      add constraint planning_assignments_execution_segment_id_fkey
      foreign key (execution_segment_id)
      references public.activity_execution_segments(id)
      on delete cascade;
  end if;
end;
$$;

alter table if exists planning_assignments
  alter column planning_item_id drop not null;

alter table if exists planning_assignments
  drop constraint if exists planning_assignments_item_type_order_uidx;

drop index if exists planning_assignments_item_type_order_uidx;

alter table if exists planning_assignments
  drop constraint if exists planning_assignments_exactly_one_target_check;

alter table if exists planning_assignments
  add constraint planning_assignments_exactly_one_target_check check (
    (
      planning_item_id is not null
      and execution_segment_id is null
    )
    or (
      planning_item_id is null
      and execution_segment_id is not null
    )
  );

create index if not exists planning_assignments_execution_segment_id_idx
  on planning_assignments (execution_segment_id);

create unique index if not exists planning_assignments_planning_item_type_order_uidx
  on planning_assignments (planning_item_id, assignment_type_id, instance_order)
  where planning_item_id is not null;

create unique index if not exists planning_assignments_execution_segment_type_order_uidx
  on planning_assignments (execution_segment_id, assignment_type_id, instance_order)
  where execution_segment_id is not null;

create or replace function replace_assignments_for_target(
  p_target_kind text,
  p_target_id bigint,
  p_assignments jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  assignment_record jsonb;
  value_record jsonb;
  inserted_assignment_id bigint;
begin
  if p_target_kind not in ('planning_item', 'execution_segment') then
    raise exception 'p_target_kind must be planning_item or execution_segment';
  end if;

  if p_target_id is null or p_target_id <= 0 then
    raise exception 'p_target_id must be a positive bigint';
  end if;

  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'p_assignments must be a JSON array';
  end if;

  if p_target_kind = 'planning_item' then
    delete from planning_assignments
    where planning_item_id = p_target_id;
  else
    delete from planning_assignments
    where execution_segment_id = p_target_id;
  end if;

  for assignment_record in
    select value from jsonb_array_elements(p_assignments)
  loop
    insert into planning_assignments (
      planning_item_id,
      execution_segment_id,
      assignment_type_id,
      instance_order
    )
    values (
      case when p_target_kind = 'planning_item' then p_target_id else null end,
      case when p_target_kind = 'execution_segment' then p_target_id else null end,
      (assignment_record ->> 'assignment_type_id')::bigint,
      (assignment_record ->> 'instance_order')::integer
    )
    returning id into inserted_assignment_id;

    for value_record in
      select value from jsonb_array_elements(coalesce(assignment_record -> 'values', '[]'::jsonb))
    loop
      insert into planning_assignment_values (
        assignment_id,
        field_id,
        option_id,
        value_text,
        value_number,
        value_date,
        value_boolean,
        value_json
      )
      values (
        inserted_assignment_id,
        (value_record ->> 'field_id')::bigint,
        nullif(value_record ->> 'option_id', '')::bigint,
        value_record ->> 'value_text',
        nullif(value_record ->> 'value_number', '')::numeric,
        nullif(value_record ->> 'value_date', '')::date,
        nullif(value_record ->> 'value_boolean', '')::boolean,
        coalesce(value_record -> 'value_json', '{}'::jsonb)
      );
    end loop;
  end loop;
end;
$$;

create or replace function replace_planning_assignments(
  p_planning_item_id bigint,
  p_assignments jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform replace_assignments_for_target('planning_item', p_planning_item_id, p_assignments);
end;
$$;

revoke all on function replace_assignments_for_target(text, bigint, jsonb) from public;
revoke all on function replace_assignments_for_target(text, bigint, jsonb) from authenticated;
grant execute on function replace_assignments_for_target(text, bigint, jsonb) to service_role;

revoke all on function replace_planning_assignments(bigint, jsonb) from public;
revoke all on function replace_planning_assignments(bigint, jsonb) from authenticated;
grant execute on function replace_planning_assignments(bigint, jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
