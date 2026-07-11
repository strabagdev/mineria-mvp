-- H6.2B: optional grouping order for Operational Header fields.
-- Null keeps the current behavior: consumers may fall back to sort_order.

alter table if exists operational_header_fields
  add column if not exists grouping_order integer null;

select pg_notify('pgrst', 'reload schema');
