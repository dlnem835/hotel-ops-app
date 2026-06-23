-- Add Every Other Month (bimonthly) PM frequency

ALTER TABLE pm_templates DROP CONSTRAINT IF EXISTS pm_templates_frequency_check;

ALTER TABLE pm_templates ADD CONSTRAINT pm_templates_frequency_check CHECK (
  frequency IN (
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'bimonthly',
    'quarterly',
    'triannually',
    'semiannually',
    'yearly'
  )
);
