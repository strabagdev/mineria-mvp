create extension if not exists btree_gist;

alter table activity_execution_segments
  drop constraint if exists activity_execution_segments_no_overlap;

alter table activity_execution_segments
  add constraint activity_execution_segments_no_overlap
  exclude using gist (
    activity_group_id with =,
    tsrange(
      item_date::timestamp + start_time,
      item_date::timestamp + end_time + case when end_time <= start_time then interval '1 day' else interval '0 day' end,
      '[)'
    ) with &&
  );
