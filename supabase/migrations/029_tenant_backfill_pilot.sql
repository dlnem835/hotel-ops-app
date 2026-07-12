-- Migration 029: Backfill pilot organization_id=1 and property_id=1 on all tenant tables
-- Applied to Supabase (Checkpoint 2).

BEGIN;

-- Root tables
UPDATE buildings_and_areas SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE property_inspection_templates SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE inspection_sessions SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE pm_templates SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE pm_occurrences SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE work_orders SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE pass_on_log SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;
UPDATE lost_items SET organization_id = 1, property_id = 1 WHERE organization_id IS NULL OR property_id IS NULL;

UPDATE inspection_settings SET organization_id = 1 WHERE organization_id IS NULL;

UPDATE scheduled_report_schedules
SET organization_id = 1,
    property_id = coalesce(property_id, 1)
WHERE organization_id IS NULL;

-- Child tables via parent joins
UPDATE pm_schedule_assignments psa
SET organization_id = pt.organization_id,
    property_id = pt.property_id
FROM pm_templates pt
WHERE psa.template_id = pt.id
  AND (psa.organization_id IS NULL OR psa.property_id IS NULL);

UPDATE inspection_item_responses iir
SET organization_id = s.organization_id,
    property_id = s.property_id
FROM inspection_sessions s
WHERE iir.inspection_id = s.id
  AND (iir.organization_id IS NULL OR iir.property_id IS NULL);

UPDATE inspection_deficiencies idf
SET organization_id = s.organization_id,
    property_id = s.property_id
FROM inspection_sessions s
WHERE idf.inspection_id = s.id
  AND (idf.organization_id IS NULL OR idf.property_id IS NULL);

UPDATE area_inspection_summary ais
SET organization_id = ba.organization_id,
    property_id = ba.property_id
FROM buildings_and_areas ba
WHERE ais.area_id = ba.id
  AND (ais.organization_id IS NULL OR ais.property_id IS NULL);

UPDATE pass_on_log_replies r
SET organization_id = e.organization_id,
    property_id = e.property_id
FROM pass_on_log e
WHERE r.entry_id = e.id
  AND (r.organization_id IS NULL OR r.property_id IS NULL);

UPDATE pass_on_log_views v
SET organization_id = e.organization_id,
    property_id = e.property_id
FROM pass_on_log e
WHERE v.entry_id = e.id
  AND (v.organization_id IS NULL OR v.property_id IS NULL);

UPDATE scheduled_report_runs rr
SET organization_id = ss.organization_id,
    property_id = ss.property_id
FROM scheduled_report_schedules ss
WHERE rr.schedule_id = ss.id
  AND (rr.organization_id IS NULL OR rr.property_id IS NULL);

COMMIT;
