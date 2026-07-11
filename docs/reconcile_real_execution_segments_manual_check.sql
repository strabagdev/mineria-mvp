-- Manual verification script for reconcile_real_execution_segments rollback behavior.
--
-- Run only against a disposable local/staging database after applying migrations
-- through supabase/sql/017_reconcile_real_execution_segments.sql.
--
-- Expected result:
-- - The function raises the assignment protection error.
-- - The transaction rolls back.
-- - The original execution segments and operational_header_values remain unchanged.

begin;

-- Replace these ids with records from the disposable database:
--   :segment_id should be one segment from a real event with two segments.
--   :planning_item_id should be the associated planning item.
--   :activity_group_id should match both records.
--   The surplus segment must have at least one planning_assignments row.
select reconcile_real_execution_segments(
  :segment_id,
  :planning_item_id,
  :'activity_group_id',
  jsonb_build_array(
    jsonb_build_object(
      'item_date', '2026-06-01',
      'start_time', '10:00',
      'end_time', '18:00',
      'shift', 'Dia',
      'category', 'actividad',
      'item_type', 'unitaria',
      'description', 'Rollback check',
      'notes', null
    )
  ),
  '[]'::jsonb,
  null,
  'manual-check@example.com',
  :created_by
);

-- This line should not be reached when the assignment protection is working.
rollback;
