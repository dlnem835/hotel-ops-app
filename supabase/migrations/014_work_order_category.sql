-- Work order category for reporting; optional item free text
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS item TEXT;

ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_category_check;

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_category_check CHECK (
    category IS NULL
    OR category IN (
      'HVAC',
      'Plumbing',
      'Electrical',
      'Fire & Life Safety',
      'Elevator',
      'Swimming Pool',
      'Grounds',
      'Waste Removal',
      'Furniture, Fixtures & Equipment',
      'Other'
    )
  );

CREATE INDEX IF NOT EXISTS work_orders_category_idx ON work_orders (category);
