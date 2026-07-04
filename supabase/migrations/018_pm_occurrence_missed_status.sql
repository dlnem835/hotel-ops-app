-- Allow missed PM cycles to be archived for history/reporting
ALTER TABLE pm_occurrences DROP CONSTRAINT IF EXISTS pm_occurrences_status_check;
ALTER TABLE pm_occurrences ADD CONSTRAINT pm_occurrences_status_check
  CHECK (status IN ('open', 'completed', 'missed'));
