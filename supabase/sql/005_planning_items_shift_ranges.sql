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
        and end_time <= time '20:00'
        and end_time > start_time
      )
      or (
        shift = 'Noche'
        and (
          (start_time >= time '20:00' and end_time > start_time)
          or (start_time >= time '20:00' and end_time <= time '08:00')
          or (start_time <= time '08:00' and end_time <= time '08:00' and end_time > start_time)
        )
      )
    )
  );
