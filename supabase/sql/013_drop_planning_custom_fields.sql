-- H5.4F: Custom Fields were retired from UI, API, reporting and offline flows.
-- The platform is pre-production, so legacy test data can be discarded.
-- Drop child tables first so ordinary drops are sufficient; table-owned
-- policies, indexes and constraints are removed with each table.

drop table if exists planning_custom_field_values;
drop table if exists planning_custom_field_options;
drop table if exists planning_custom_fields;
