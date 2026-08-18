-- Keep operational record revisions durable for offline optimistic concurrency.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planning_items_set_updated_at on public.planning_items;
create trigger planning_items_set_updated_at
before update on public.planning_items
for each row
execute function public.set_updated_at();

drop trigger if exists activity_execution_segments_set_updated_at on public.activity_execution_segments;
create trigger activity_execution_segments_set_updated_at
before update on public.activity_execution_segments
for each row
execute function public.set_updated_at();
