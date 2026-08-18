-- Transaction-safe sync mutation processing for planned planning items.

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

    v_response := jsonb_build_object('item', to_jsonb(v_item));
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

    v_response := jsonb_build_object('item', to_jsonb(v_item));
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
        else jsonb_build_object('item', to_jsonb(v_item))
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
