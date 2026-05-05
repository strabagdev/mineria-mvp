do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'planning_items'
  ) then
    alter publication supabase_realtime add table public.planning_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_execution_segments'
  ) then
    alter publication supabase_realtime add table public.activity_execution_segments;
  end if;
end $$;

alter table public.planning_items replica identity full;
alter table public.activity_execution_segments replica identity full;
