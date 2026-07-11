-- Live baseline schema export (Checkpoint 1) — sample-row inventory
-- Generated at: 2026-07-11T04:17:30.189Z
-- Source: scripts/tenant/export-live-schema-samples.mjs
--
-- Columns and inferred types from live sample rows (service role read).
-- For exact DDL including constraints, defaults, indexes, and RLS, run:
--   node scripts/tenant/export-live-ddl.mjs
-- after setting SUPABASE_DB_URL in .env.local.
-- DO NOT APPLY — reference only.

-- ── public.team_members ──
-- live row count at export: 22
CREATE TABLE public.team_members (
  auth_email text,
  auth_user_id uuid (inferred),
  can_login boolean,
  created_at timestamptz (inferred),
  department text,
  email text,
  first_name text,
  id uuid (inferred),
  is_administrator boolean,
  job_title text,
  last_name text,
  module_permissions jsonb,
  phone text,
  property_id integer,
  role text,
  status text,
  username text
);

-- ── public.pass_on_log ──
-- live row count at export: 33
CREATE TABLE public.pass_on_log (
  author text,
  completed boolean,
  created_at timestamptz (inferred),
  edited_at unknown (null in sample),
  entry_date date (inferred),
  id integer,
  message text,
  priority text,
  shift unknown (null in sample),
  subject text
);

-- ── public.pass_on_log_replies ──
-- live row count at export: 14
CREATE TABLE public.pass_on_log_replies (
  created_at timestamptz (inferred),
  edited_at unknown (null in sample),
  entry_id integer,
  id integer,
  reply_author text,
  reply_message text
);

-- ── public.pass_on_log_views ──
-- live row count at export: 206
CREATE TABLE public.pass_on_log_views (
  auth_user_id uuid (inferred),
  created_at timestamptz (inferred),
  entry_id integer,
  id integer,
  viewed_at timestamptz (inferred)
);

-- ── public.lost_items ──
-- live row count at export: 2
CREATE TABLE public.lost_items (
  comments text,
  created_at timestamptz (inferred),
  created_by uuid (inferred),
  date_found unknown (null in sample),
  description unknown (null in sample),
  found_by text,
  guest_last_name text,
  id integer,
  item_name text,
  label_requested_at timestamptz (inferred),
  label_sent_at timestamptz (inferred),
  label_url text,
  notes unknown (null in sample),
  room_number text,
  status text,
  tracking_number unknown (null in sample)
);
