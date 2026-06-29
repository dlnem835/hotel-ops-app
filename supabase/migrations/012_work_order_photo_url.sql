-- Attach inspection/PM deficiency photos to work orders
-- Run after 009_maintenance_work_orders.sql

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
