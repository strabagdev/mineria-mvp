-- H5.6: remove legacy Nivel/Frente storage after Operational Header became the source of truth.

drop index if exists planning_items_front_idx;
drop index if exists operational_header_fields_active_legacy_column_uidx;
drop index if exists operational_header_fields_legacy_column_idx;

alter table if exists operational_header_fields
  drop constraint if exists operational_header_fields_legacy_column_check;

alter table if exists planning_items
  drop column if exists level,
  drop column if exists front;

alter table if exists activity_execution_segments
  drop column if exists level,
  drop column if exists front;

alter table if exists operational_header_fields
  drop column if exists legacy_column;

do $$
begin
  if to_regclass('public.planning_levels') is not null then
    drop policy if exists planning_levels_select_approved on planning_levels;
  end if;
end $$;

drop table if exists planning_levels;

select pg_notify('pgrst', 'reload schema');
