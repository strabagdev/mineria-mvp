alter table if exists assignment_types
  add column if not exists icon_key text null;

alter table if exists assignment_types
  drop constraint if exists assignment_types_icon_key_check;

alter table if exists assignment_types
  add constraint assignment_types_icon_key_check check (
    icon_key is null
    or icon_key in (
      'truck',
      'hard-hat',
      'users',
      'building',
      'wrench',
      'package',
      'clipboard-list',
      'user',
      'layers'
    )
  );

select pg_notify('pgrst', 'reload schema');
