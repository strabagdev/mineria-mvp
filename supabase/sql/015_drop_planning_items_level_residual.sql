-- Defensive cleanup: planning_items.level is no longer part of the runtime model.
-- Cabecera Operacional is the only source of truth for Nivel.

alter table if exists planning_items
  drop column if exists level;

select pg_notify('pgrst', 'reload schema');
