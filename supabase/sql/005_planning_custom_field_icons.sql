alter table if exists planning_custom_fields
  add column if not exists icon_key text null;

alter table if exists planning_custom_fields
  drop constraint if exists planning_custom_fields_icon_key_check;

alter table if exists planning_custom_fields
  add constraint planning_custom_fields_icon_key_check check (
    icon_key is null
    or icon_key in (
      'truck',
      'hard-hat',
      'users',
      'building',
      'calendar',
      'map-pin',
      'clipboard-list',
      'wrench',
      'shield-alert',
      'file-text',
      'tag',
      'clock',
      'user',
      'package',
      'layers'
    )
  );

select pg_notify('pgrst', 'reload schema');
