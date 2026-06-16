alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  alter column role set default 'viewer';

alter table profiles
  add constraint profiles_role_check
  check (role in ('admin', 'operator', 'viewer'));

update profiles
set role = 'operator'
where role = 'viewer'
  and active = true
  and approval_status = 'approved';

select pg_notify('pgrst', 'reload schema');
