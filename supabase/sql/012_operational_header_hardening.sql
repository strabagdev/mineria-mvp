create unique index if not exists operational_header_fields_active_legacy_column_uidx
  on operational_header_fields (legacy_column)
  where legacy_column is not null
    and active = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_header_field_options_id_field_id_uid'
  ) then
    alter table operational_header_field_options
      add constraint operational_header_field_options_id_field_id_uid
      unique (id, field_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_header_option_dependencies_option_field_fkey'
  ) then
    alter table operational_header_option_dependencies
      add constraint operational_header_option_dependencies_option_field_fkey
      foreign key (option_id, field_id)
      references operational_header_field_options (id, field_id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_header_option_dependencies_depends_on_option_field_fkey'
  ) then
    alter table operational_header_option_dependencies
      add constraint operational_header_option_dependencies_depends_on_option_field_fkey
      foreign key (depends_on_option_id, depends_on_field_id)
      references operational_header_field_options (id, field_id)
      on delete cascade;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
