-- Separate operational data consumption from visual catalog access.

alter table if exists user_permissions
  drop constraint if exists user_permissions_permission_check;

alter table if exists user_permissions
  add constraint user_permissions_permission_check check (
    permission in (
      'records.view',
      'records.create',
      'records.edit',
      'records.delete',
      'catalog.data.read',
      'catalog.view',
      'catalog.manage',
      'reports.view',
      'users.view',
      'users.manage',
      'audit.view',
      'operational_header.data.read',
      'operational_header.view',
      'operational_header.manage',
      'assignments.view',
      'assignments.manage'
    )
  );

insert into user_permissions (user_id, permission, effect)
select user_id, 'catalog.data.read', effect
from user_permissions
where permission = 'catalog.view'
on conflict (user_id, permission) do nothing;

insert into user_permissions (user_id, permission, effect)
select user_id, 'operational_header.data.read', effect
from user_permissions
where permission = 'operational_header.view'
on conflict (user_id, permission) do nothing;

select pg_notify('pgrst', 'reload schema');
