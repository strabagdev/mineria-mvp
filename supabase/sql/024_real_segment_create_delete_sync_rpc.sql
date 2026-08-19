-- Transaction-safe sync mutation processing for real execution segment create/delete.

create or replace function public.process_planned_item_sync_mutation(
  p_mutation_id text,
  p_operation text,
  p_actor_user_id uuid,
  p_entity_id bigint default null,
  p_expected_updated_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sync_processed_mutations%rowtype;
  v_item public.planning_items%rowtype;
  v_deleted public.planning_items%rowtype;
  v_header_value jsonb;
  v_header_values jsonb := '[]'::jsonb;
  v_field_id bigint;
  v_option_id bigint;
  v_value_text text;
  v_response jsonb;
  v_entity_id text;
  v_revision text;
begin
  if p_mutation_id is null or btrim(p_mutation_id) = '' then
    raise exception 'sync_mutation_id_required' using errcode = '22023';
  end if;

  select *
    into v_existing
    from public.sync_processed_mutations
   where mutation_id = p_mutation_id
     and domain = 'planning'
     and scope_user_id is null
   limit 1;

  if found then
    return v_existing.response;
  end if;

  if p_operation = 'create' then
    insert into public.planning_items (
      created_by,
      activity_group_id,
      client_mutation_id,
      item_date,
      start_time,
      end_time,
      shift,
      category,
      tracking_type,
      item_type,
      description,
      notes
    )
    values (
      p_actor_user_id,
      coalesce(nullif(p_payload->>'activity_group_id', ''), gen_random_uuid()::text),
      p_mutation_id,
      (p_payload->>'item_date')::date,
      (p_payload->>'start_time')::time,
      (p_payload->>'end_time')::time,
      p_payload->>'shift',
      p_payload->>'category',
      'programado',
      p_payload->>'item_type',
      p_payload->>'description',
      nullif(p_payload->>'notes', '')
    )
    returning * into v_item;

    v_entity_id := v_item.id::text;
    v_revision := v_item.updated_at::text;
  elsif p_operation = 'update' then
    update public.planning_items
       set activity_group_id = coalesce(nullif(p_payload->>'activity_group_id', ''), activity_group_id),
           item_date = (p_payload->>'item_date')::date,
           start_time = (p_payload->>'start_time')::time,
           end_time = (p_payload->>'end_time')::time,
           shift = p_payload->>'shift',
           category = p_payload->>'category',
           tracking_type = 'programado',
           item_type = p_payload->>'item_type',
           description = p_payload->>'description',
           notes = nullif(p_payload->>'notes', ''),
           updated_at = now()
     where id = p_entity_id
       and tracking_type = 'programado'
       and (p_expected_updated_at is null or updated_at = p_expected_updated_at)
    returning * into v_item;

    if not found then
      raise exception 'sync_concurrency_conflict' using errcode = '40001';
    end if;

    v_entity_id := v_item.id::text;
    v_revision := v_item.updated_at::text;
  elsif p_operation = 'delete' then
    select *
      into v_deleted
      from public.planning_items
     where id = p_entity_id
       and tracking_type = 'programado';

    if not found then
      v_response := jsonb_build_object('ok', true);
      v_entity_id := coalesce(p_entity_id::text, '');
      v_revision := null;
    else
      if exists (
        select 1
          from public.activity_execution_segments
         where planning_item_id = v_deleted.id
         limit 1
      ) then
        raise exception 'sync_delete_blocked_by_real' using errcode = '23514';
      end if;

      delete from public.planning_items
       where id = v_deleted.id
         and (p_expected_updated_at is null or updated_at = p_expected_updated_at);

      if not found then
        raise exception 'sync_concurrency_conflict' using errcode = '40001';
      end if;

      v_response := jsonb_build_object('ok', true);
      v_entity_id := v_deleted.id::text;
      v_revision := v_deleted.updated_at::text;
    end if;
  else
    raise exception 'sync_operation_not_supported' using errcode = '22023';
  end if;

  if p_operation in ('create', 'update') then
    v_header_values := coalesce(p_payload->'operational_header_values', '[]'::jsonb);

    if jsonb_typeof(v_header_values) <> 'array' then
      raise exception 'Los valores de Cabecera Operacional no son validos.';
    end if;

    for v_header_value in
      select value from jsonb_array_elements(v_header_values)
    loop
      v_field_id := nullif(v_header_value ->> 'field_id', '')::bigint;
      v_option_id := nullif(v_header_value ->> 'option_id', '')::bigint;
      v_value_text := nullif(btrim(coalesce(v_header_value ->> 'value', '')), '');

      if v_field_id is null or (v_option_id is null and v_value_text is null) then
        continue;
      end if;

      insert into public.operational_header_values (
        field_id,
        activity_group_id,
        planning_item_id,
        execution_segment_id,
        option_id,
        value_text
      )
      values (
        v_field_id,
        v_item.activity_group_id,
        v_item.id,
        null,
        v_option_id,
        case when v_option_id is null then v_value_text else null end
      )
      on conflict (field_id, planning_item_id) where planning_item_id is not null
      do update set
        activity_group_id = excluded.activity_group_id,
        option_id = excluded.option_id,
        value_text = excluded.value_text,
        updated_at = now();
    end loop;

    v_response := jsonb_build_object(
      'item',
      to_jsonb(v_item) || jsonb_build_object('operational_header_values', v_header_values)
    );
  end if;

  if v_entity_id <> '' then
    insert into public.sync_changes (
      scope_user_id,
      domain,
      entity_type,
      entity_id,
      operation,
      server_revision,
      payload,
      mutation_id,
      actor_user_id
    )
    values (
      null,
      'planning',
      'planning_item',
      v_entity_id,
      case when p_operation = 'delete' then 'delete' else 'upsert' end,
      v_revision,
      case
        when p_operation = 'delete' then jsonb_build_object(
          'id', p_entity_id,
          'tracking_type', 'programado',
          'item_date', v_deleted.item_date
        )
        else jsonb_build_object('item', (to_jsonb(v_item) || jsonb_build_object('operational_header_values', v_header_values)))
      end,
      p_mutation_id,
      p_actor_user_id
    );
  end if;

  insert into public.sync_processed_mutations (
    mutation_id,
    scope_user_id,
    domain,
    operation,
    entity_type,
    entity_id,
    server_revision,
    response,
    actor_user_id
  )
  values (
    p_mutation_id,
    null,
    'planning',
    p_operation,
    'planning_item',
    nullif(v_entity_id, ''),
    v_revision,
    v_response,
    p_actor_user_id
  );

  return v_response;
end;
$$;

create or replace function public.process_real_segment_create_sync_mutation(
  p_mutation_id text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_created_by uuid,
  p_planning_item_id bigint default null,
  p_activity_group_id text default null,
  p_segments jsonb default '[]'::jsonb,
  p_operational_header_values jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sync_processed_mutations%rowtype;
  v_segment jsonb;
  v_header_value jsonb;
  v_row public.activity_execution_segments%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_ids bigint[] := '{}'::bigint[];
  v_base_segment_order integer;
  v_index integer := 0;
  v_target_segment_id bigint;
  v_field_id bigint;
  v_option_id bigint;
  v_value_text text;
  v_response jsonb;
begin
  if p_mutation_id is null or btrim(p_mutation_id) = '' then
    raise exception 'sync_mutation_id_required' using errcode = '22023';
  end if;

  select *
    into v_existing
    from public.sync_processed_mutations
   where mutation_id = p_mutation_id
     and domain = 'planning'
     and scope_user_id is null
   limit 1;

  if found then
    return v_existing.response;
  end if;

  if btrim(coalesce(p_activity_group_id, '')) = '' then
    raise exception 'El grupo operacional del real no es valido.';
  end if;

  if jsonb_typeof(p_segments) <> 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'La creacion requiere al menos un tramo real.';
  end if;

  if p_operational_header_values is null then
    p_operational_header_values := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_operational_header_values) <> 'array' then
    raise exception 'Los valores de Cabecera Operacional no son validos.';
  end if;

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
    join public.activity_execution_segments existing_segment
      on existing_segment.activity_group_id = p_activity_group_id
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

  perform pg_advisory_xact_lock(hashtext(p_activity_group_id));

  select coalesce(max(segment_order), 0) + 1
    into v_base_segment_order
    from public.activity_execution_segments
   where activity_group_id = p_activity_group_id;

  for v_segment in
    select value from jsonb_array_elements(p_segments)
  loop
    v_index := v_index + 1;

    insert into public.activity_execution_segments (
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
      p_mutation_id,
      p_created_by,
      v_base_segment_order + v_index - 1
    )
    returning * into v_row;

    v_ids := array_append(v_ids, v_row.id);
  end loop;

  foreach v_target_segment_id in array v_ids loop
    for v_header_value in
      select value from jsonb_array_elements(p_operational_header_values)
    loop
      v_field_id := nullif(v_header_value ->> 'field_id', '')::bigint;
      v_option_id := nullif(v_header_value ->> 'option_id', '')::bigint;
      v_value_text := nullif(btrim(coalesce(v_header_value ->> 'value', '')), '');

      if v_field_id is null or (v_option_id is null and v_value_text is null) then
        continue;
      end if;

      insert into public.operational_header_values (
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

  select coalesce(jsonb_agg(to_jsonb(segment_row) || jsonb_build_object('tracking_type', 'real') order by segment_row.segment_order, segment_row.id), '[]'::jsonb)
    into v_rows
    from public.activity_execution_segments segment_row
   where segment_row.id = any(v_ids);

  insert into public.audit_logs (
    actor_user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    after_data,
    metadata
  )
  values (
    p_actor_user_id,
    p_actor_email,
    'activity_execution_segment.created',
    'activity_execution_segment',
    coalesce((v_ids[1])::text, null),
    v_rows,
    jsonb_build_object(
      'operation', 'process_real_segment_create_sync_mutation',
      'count', jsonb_array_length(v_rows),
      'activity_group_id', p_activity_group_id
    )
  );

  for v_row in
    select *
      from public.activity_execution_segments segment_row
     where segment_row.id = any(v_ids)
  loop
    insert into public.sync_changes (
      scope_user_id,
      domain,
      entity_type,
      entity_id,
      operation,
      server_revision,
      payload,
      mutation_id,
      actor_user_id
    )
    values (
      null,
      'planning',
      'activity_execution_segment',
      v_row.id::text,
      'upsert',
      v_row.updated_at::text,
      jsonb_build_object('item', to_jsonb(v_row) || jsonb_build_object('tracking_type', 'real')),
      p_mutation_id,
      p_actor_user_id
    );
  end loop;

  v_response := jsonb_build_object(
    'item', coalesce(v_rows -> 0, 'null'::jsonb),
    'items', v_rows
  );

  insert into public.sync_processed_mutations (
    mutation_id,
    scope_user_id,
    domain,
    operation,
    entity_type,
    entity_id,
    server_revision,
    response,
    actor_user_id
  )
  values (
    p_mutation_id,
    null,
    'planning',
    'create',
    'activity_execution_segment',
    coalesce((v_ids[1])::text, null),
    (select max(updated_at)::text from public.activity_execution_segments where id = any(v_ids)),
    v_response,
    p_actor_user_id
  );

  return v_response;
end;
$$;

create or replace function public.process_real_segment_delete_sync_mutation(
  p_mutation_id text,
  p_segment_id bigint,
  p_actor_user_id uuid,
  p_actor_email text,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sync_processed_mutations%rowtype;
  v_deleted public.activity_execution_segments%rowtype;
  v_response jsonb;
begin
  if p_mutation_id is null or btrim(p_mutation_id) = '' then
    raise exception 'sync_mutation_id_required' using errcode = '22023';
  end if;

  select *
    into v_existing
    from public.sync_processed_mutations
   where mutation_id = p_mutation_id
     and domain = 'planning'
     and scope_user_id is null
   limit 1;

  if found then
    return v_existing.response;
  end if;

  select *
    into v_deleted
    from public.activity_execution_segments
   where id = p_segment_id
   for update;

  if not found then
    v_response := jsonb_build_object('ok', true);
  else
    if p_expected_updated_at is not null and v_deleted.updated_at <> p_expected_updated_at then
      raise exception 'sync_concurrency_conflict' using errcode = '40001';
    end if;

    delete from public.activity_execution_segments
     where id = v_deleted.id;

    insert into public.audit_logs (
      actor_user_id,
      actor_email,
      action,
      entity_type,
      entity_id,
      before_data
    )
    values (
      p_actor_user_id,
      p_actor_email,
      'activity_execution_segment.deleted',
      'activity_execution_segment',
      v_deleted.id::text,
      to_jsonb(v_deleted)
    );

    insert into public.sync_changes (
      scope_user_id,
      domain,
      entity_type,
      entity_id,
      operation,
      server_revision,
      payload,
      mutation_id,
      actor_user_id
    )
    values (
      null,
      'planning',
      'activity_execution_segment',
      v_deleted.id::text,
      'delete',
      v_deleted.updated_at::text,
      jsonb_build_object(
        'id', v_deleted.id,
        'tracking_type', 'real',
        'item_date', v_deleted.item_date
      ),
      p_mutation_id,
      p_actor_user_id
    );

    v_response := jsonb_build_object('ok', true);
  end if;

  insert into public.sync_processed_mutations (
    mutation_id,
    scope_user_id,
    domain,
    operation,
    entity_type,
    entity_id,
    server_revision,
    response,
    actor_user_id
  )
  values (
    p_mutation_id,
    null,
    'planning',
    'delete',
    'activity_execution_segment',
    coalesce(v_deleted.id::text, p_segment_id::text),
    v_deleted.updated_at::text,
    v_response,
    p_actor_user_id
  );

  return v_response;
end;
$$;

revoke all on function public.process_real_segment_create_sync_mutation(text, uuid, text, uuid, bigint, text, jsonb, jsonb) from public;
revoke all on function public.process_real_segment_create_sync_mutation(text, uuid, text, uuid, bigint, text, jsonb, jsonb) from authenticated;
grant execute on function public.process_real_segment_create_sync_mutation(text, uuid, text, uuid, bigint, text, jsonb, jsonb) to service_role;

revoke all on function public.process_real_segment_delete_sync_mutation(text, bigint, uuid, text, timestamptz) from public;
revoke all on function public.process_real_segment_delete_sync_mutation(text, bigint, uuid, text, timestamptz) from authenticated;
grant execute on function public.process_real_segment_delete_sync_mutation(text, bigint, uuid, text, timestamptz) to service_role;

select pg_notify('pgrst', 'reload schema');
