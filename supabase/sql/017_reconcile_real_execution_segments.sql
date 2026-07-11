-- Atomic reconciliation for real execution segments edited from the planning UI.

create or replace function reconcile_real_execution_segments(
  p_segment_id bigint,
  p_planning_item_id bigint,
  p_activity_group_id text,
  p_segments jsonb,
  p_operational_header_values jsonb,
  p_actor_user_id uuid,
  p_actor_email text,
  p_created_by uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_current activity_execution_segments%rowtype;
  v_logical_client_mutation_id text;
  v_existing_ids bigint[] := '{}'::bigint[];
  v_extra_ids bigint[] := '{}'::bigint[];
  v_result_ids bigint[] := '{}'::bigint[];
  v_before_data jsonb := '[]'::jsonb;
  v_after_data jsonb := '[]'::jsonb;
  v_segment jsonb;
  v_header_value jsonb;
  v_index integer;
  v_desired_count integer;
  v_target_segment_id bigint;
  v_insert_segment_order integer;
  v_row activity_execution_segments%rowtype;
  v_field_id bigint;
  v_option_id bigint;
  v_value_text text;
begin
  if p_segment_id is null or p_segment_id <= 0 then
    raise exception 'El segmento real indicado no es valido.';
  end if;

  if btrim(coalesce(p_activity_group_id, '')) = '' then
    raise exception 'El grupo operacional del real no es valido.';
  end if;

  if jsonb_typeof(p_segments) <> 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'La reconciliacion requiere al menos un tramo real.';
  end if;

  if p_operational_header_values is null then
    p_operational_header_values := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_operational_header_values) <> 'array' then
    raise exception 'Los valores de Cabecera Operacional no son validos.';
  end if;

  select *
  into v_current
  from activity_execution_segments
  where id = p_segment_id
  for update;

  if not found then
    raise exception 'No se encontro el segmento real indicado.';
  end if;

  v_logical_client_mutation_id := coalesce(
    nullif(v_current.client_mutation_id, ''),
    'reconciled-real-' || v_current.id::text
  );

  select coalesce(array_agg(id order by segment_order, id), '{}'::bigint[])
  into v_existing_ids
  from (
    select *
    from activity_execution_segments
    where (
      client_mutation_id = v_logical_client_mutation_id
      or id = v_current.id
    )
    for update
  ) locked_segments;

  if not v_current.id = any(v_existing_ids) then
    v_existing_ids := array_prepend(v_current.id, v_existing_ids);
  end if;

  select coalesce(jsonb_agg(to_jsonb(segment_row) order by segment_row.segment_order, segment_row.id), '[]'::jsonb)
  into v_before_data
  from activity_execution_segments segment_row
  where segment_row.id = any(v_existing_ids);

  v_desired_count := jsonb_array_length(p_segments);

  if exists (
    with desired as (
      select
        ordinality,
        (value ->> 'item_date')::date as item_date,
        (value ->> 'start_time')::time as start_time,
        (value ->> 'end_time')::time as end_time
      from jsonb_array_elements(p_segments) with ordinality
    )
    select 1
    from desired left_segment
    join desired right_segment
      on left_segment.ordinality < right_segment.ordinality
    where tsrange(
        left_segment.item_date::timestamp + left_segment.start_time,
        left_segment.item_date::timestamp + left_segment.end_time + case when left_segment.end_time <= left_segment.start_time then interval '1 day' else interval '0 day' end,
        '[)'
      ) && tsrange(
        right_segment.item_date::timestamp + right_segment.start_time,
        right_segment.item_date::timestamp + right_segment.end_time + case when right_segment.end_time <= right_segment.start_time then interval '1 day' else interval '0 day' end,
        '[)'
      )
  ) then
    raise exception 'Los eventos reales de una misma programacion no pueden solaparse.';
  end if;

  if exists (
    with desired as (
      select
        (value ->> 'item_date')::date as item_date,
        (value ->> 'start_time')::time as start_time,
        (value ->> 'end_time')::time as end_time
      from jsonb_array_elements(p_segments)
    )
    select 1
    from desired
    join activity_execution_segments existing_segment
      on existing_segment.activity_group_id = p_activity_group_id
     and not existing_segment.id = any(v_existing_ids)
     and tsrange(
        existing_segment.item_date::timestamp + existing_segment.start_time,
        existing_segment.item_date::timestamp + existing_segment.end_time + case when existing_segment.end_time <= existing_segment.start_time then interval '1 day' else interval '0 day' end,
        '[)'
      ) && tsrange(
        desired.item_date::timestamp + desired.start_time,
        desired.item_date::timestamp + desired.end_time + case when desired.end_time <= desired.start_time then interval '1 day' else interval '0 day' end,
        '[)'
      )
  ) then
    raise exception 'Ese horario se solapa con otro evento real del mismo programado. Actualiza la planificacion y elige un espacio disponible.';
  end if;

  select coalesce(array_agg(id order by ordinality), '{}'::bigint[])
  into v_extra_ids
  from unnest(v_existing_ids) with ordinality as existing_segment(id, ordinality)
  where existing_segment.ordinality > v_desired_count;

  if exists (
    select 1
    from planning_assignments
    where execution_segment_id = any(v_extra_ids)
  ) then
    raise exception 'No se puede eliminar un tramo que tiene asignaciones. Reasigna o elimina esas asignaciones antes de reducir el evento.';
  end if;

  delete from activity_execution_segments
  where id = any(v_extra_ids);

  select coalesce(max(segment_order), 0) + 1
  into v_insert_segment_order
  from activity_execution_segments
  where activity_group_id = p_activity_group_id;

  for v_index in 1..v_desired_count loop
    v_segment := p_segments -> (v_index - 1);
    v_target_segment_id := v_existing_ids[v_index];

    if v_target_segment_id is not null then
      update activity_execution_segments
      set
        planning_item_id = p_planning_item_id,
        activity_group_id = p_activity_group_id,
        item_date = (v_segment ->> 'item_date')::date,
        start_time = (v_segment ->> 'start_time')::time,
        end_time = (v_segment ->> 'end_time')::time,
        shift = v_segment ->> 'shift',
        category = v_segment ->> 'category',
        item_type = v_segment ->> 'item_type',
        description = v_segment ->> 'description',
        notes = nullif(v_segment ->> 'notes', ''),
        client_mutation_id = v_logical_client_mutation_id,
        updated_at = now()
      where id = v_target_segment_id
      returning * into v_row;
    else
      insert into activity_execution_segments (
        planning_item_id,
        activity_group_id,
        item_date,
        start_time,
        end_time,
        shift,
        category,
        item_type,
        description,
        notes,
        client_mutation_id,
        created_by,
        segment_order
      )
      values (
        p_planning_item_id,
        p_activity_group_id,
        (v_segment ->> 'item_date')::date,
        (v_segment ->> 'start_time')::time,
        (v_segment ->> 'end_time')::time,
        v_segment ->> 'shift',
        v_segment ->> 'category',
        v_segment ->> 'item_type',
        v_segment ->> 'description',
        nullif(v_segment ->> 'notes', ''),
        v_logical_client_mutation_id,
        p_created_by,
        v_insert_segment_order + v_index - 1
      )
      returning * into v_row;
    end if;

    v_result_ids := array_append(v_result_ids, v_row.id);
  end loop;

  foreach v_target_segment_id in array v_result_ids loop
    for v_header_value in
      select value from jsonb_array_elements(p_operational_header_values)
    loop
      v_field_id := nullif(v_header_value ->> 'field_id', '')::bigint;
      v_option_id := nullif(v_header_value ->> 'option_id', '')::bigint;
      v_value_text := nullif(btrim(coalesce(v_header_value ->> 'value', '')), '');

      if v_field_id is null or (v_option_id is null and v_value_text is null) then
        continue;
      end if;

      insert into operational_header_values (
        field_id,
        activity_group_id,
        planning_item_id,
        execution_segment_id,
        option_id,
        value_text
      )
      values (
        v_field_id,
        p_activity_group_id,
        null,
        v_target_segment_id,
        v_option_id,
        case when v_option_id is null then v_value_text else null end
      )
      on conflict (field_id, execution_segment_id) where execution_segment_id is not null
      do update set
        activity_group_id = excluded.activity_group_id,
        option_id = excluded.option_id,
        value_text = excluded.value_text,
        updated_at = now();
    end loop;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(segment_row) order by segment_row.segment_order, segment_row.id), '[]'::jsonb)
  into v_after_data
  from activity_execution_segments segment_row
  where segment_row.id = any(v_result_ids);

  insert into audit_logs (
    actor_user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  values (
    p_actor_user_id,
    p_actor_email,
    'activity_execution_segment.updated',
    'activity_execution_segment',
    coalesce((v_result_ids[1])::text, p_segment_id::text),
    v_before_data,
    v_after_data,
    jsonb_build_object(
      'operation', 'reconcile_real_execution_segments',
      'count', jsonb_array_length(v_after_data),
      'deleted_count', coalesce(array_length(v_extra_ids, 1), 0),
      'activity_group_id', p_activity_group_id
    )
  );

  return v_after_data;
end;
$$;

revoke all on function reconcile_real_execution_segments(bigint, bigint, text, jsonb, jsonb, uuid, text, uuid) from public;
revoke all on function reconcile_real_execution_segments(bigint, bigint, text, jsonb, jsonb, uuid, text, uuid) from authenticated;
grant execute on function reconcile_real_execution_segments(bigint, bigint, text, jsonb, jsonb, uuid, text, uuid) to service_role;

select pg_notify('pgrst', 'reload schema');
