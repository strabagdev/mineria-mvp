alter table if exists profiles enable row level security;
alter table if exists planning_items enable row level security;
alter table if exists planning_catalog_types enable row level security;
alter table if exists planning_catalog_details enable row level security;
alter table if exists planning_levels enable row level security;
alter table if exists activity_execution_segments enable row level security;
alter table if exists audit_logs enable row level security;

drop policy if exists profiles_select_own_or_admin on profiles;
drop policy if exists planning_items_select_approved on planning_items;
drop policy if exists planning_catalog_types_select_approved on planning_catalog_types;
drop policy if exists planning_catalog_details_select_approved on planning_catalog_details;
drop policy if exists planning_levels_select_approved on planning_levels;
drop policy if exists activity_execution_segments_select_approved on activity_execution_segments;
drop policy if exists audit_logs_select_admin on audit_logs;

create policy profiles_select_own_or_admin
  on profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
  );

create policy planning_items_select_approved
  on planning_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );

create policy activity_execution_segments_select_approved
  on activity_execution_segments
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );

create policy planning_catalog_types_select_approved
  on planning_catalog_types
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );

create policy planning_catalog_details_select_approved
  on planning_catalog_details
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );

create policy planning_levels_select_approved
  on planning_levels
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );

create policy audit_logs_select_admin
  on audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role = 'admin'
        and current_profile.active = true
        and current_profile.approval_status = 'approved'
    )
  );
