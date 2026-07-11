-- Align planning_items_valid_range with the operational rule for planned events.
-- A planned event belongs to the shift where it starts. Its end time may fall
-- in the following shift as long as start and end are different.

do $$
declare
  invalid_count integer;
begin
  select count(*)
  into invalid_count
  from planning_items
  where not (
    start_time <> end_time
    and (
      (
        shift = 'Dia'
        and start_time >= time '08:00'
        and start_time < time '20:00'
      )
      or (
        shift = 'Noche'
        and (
          start_time >= time '20:00'
          or start_time < time '08:00'
        )
      )
    )
  );

  if invalid_count > 0 then
    raise exception 'No se puede actualizar planning_items_valid_range: existen % planning_items incompatibles con la nueva regla de inicio de turno.', invalid_count;
  end if;
end $$;

alter table planning_items
  drop constraint if exists planning_items_valid_range;

alter table planning_items
  add constraint planning_items_valid_range
  check (
    start_time <> end_time
    and (
      (
        shift = 'Dia'
        and start_time >= time '08:00'
        and start_time < time '20:00'
      )
      or (
        shift = 'Noche'
        and (
          start_time >= time '20:00'
          or start_time < time '08:00'
        )
      )
    )
  );

select pg_notify('pgrst', 'reload schema');
