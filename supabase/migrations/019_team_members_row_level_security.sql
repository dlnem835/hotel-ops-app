-- Enable Row Level Security on team_members
-- Run after 011_hotel_property_info.sql and 015_team_member_permissions.sql
--
-- Goals
--   • Close the Supabase Advisor finding (RLS disabled on public.team_members)
--   • Preserve all existing data and current app behavior
--   • Scope access by property (single property today; multi-hotel ready)
--   • Respect role / permission model (administrator, Settings module, GM/AGM)
--
-- How it works
--   1. Adds property_id (defaults to 1) so every member belongs to a hotel_property row.
--   2. Adds SECURITY DEFINER helpers that read the caller's team_members row without
--      triggering RLS recursion (same pattern as pass_on_can_manage_author).
--   3. SELECT: authenticated users may read team members in their own property only.
--      This covers directory lookups (Pass-On, Inspections, display names) and Settings.
--   4. INSERT/UPDATE/DELETE: only team managers (administrator, Settings permission,
--      or GM/AGM job title) within the same property.
--
-- What is NOT affected
--   • Server routes using SUPABASE_SERVICE_ROLE_KEY bypass RLS (create-user, update-user,
--     dashboard APIs, etc.) — no code changes required.
--   • pass_on_can_manage_author() already uses SECURITY DEFINER and continues to work.
--
-- Operational note
--   Users must have a team_members row linked via auth_user_id to read the directory.
--   Unlinked auth accounts fall back to user_metadata in the app but will not see teammates.

-- ---------------------------------------------------------------------------
-- Property scoping (multi-hotel foundation)
-- ---------------------------------------------------------------------------

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS property_id INT;

UPDATE team_members
SET property_id = 1
WHERE property_id IS NULL;

ALTER TABLE team_members
  ALTER COLUMN property_id SET DEFAULT 1;

ALTER TABLE team_members
  ALTER COLUMN property_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_members_property_id_fkey'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES hotel_property(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS team_members_auth_user_id_idx
  ON team_members (auth_user_id);

CREATE INDEX IF NOT EXISTS team_members_property_id_idx
  ON team_members (property_id);

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER — bypass RLS for policy evaluation)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_team_member_property_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.property_id
  FROM public.team_members tm
  WHERE tm.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_team_member_can_manage_team()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.auth_user_id = auth.uid()
      AND (
        coalesce(tm.is_administrator, false)
        OR coalesce((tm.module_permissions->>'settings')::boolean, false)
        OR trim(coalesce(tm.job_title, '')) IN (
          'General Manager',
          'Assistant General Manager'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_team_member_property_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_team_member_can_manage_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_team_member_property_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_team_member_can_manage_team() TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security policies
-- ---------------------------------------------------------------------------

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select_same_property" ON team_members;
CREATE POLICY "team_members_select_same_property"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    property_id IS NOT DISTINCT FROM public.auth_team_member_property_id()
  );

DROP POLICY IF EXISTS "team_managers_insert_same_property" ON team_members;
CREATE POLICY "team_managers_insert_same_property"
  ON team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_team_member_can_manage_team()
    AND property_id IS NOT DISTINCT FROM public.auth_team_member_property_id()
  );

DROP POLICY IF EXISTS "team_managers_update_same_property" ON team_members;
CREATE POLICY "team_managers_update_same_property"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (
    public.auth_team_member_can_manage_team()
    AND property_id IS NOT DISTINCT FROM public.auth_team_member_property_id()
  )
  WITH CHECK (
    public.auth_team_member_can_manage_team()
    AND property_id IS NOT DISTINCT FROM public.auth_team_member_property_id()
  );

DROP POLICY IF EXISTS "team_managers_delete_same_property" ON team_members;
CREATE POLICY "team_managers_delete_same_property"
  ON team_members
  FOR DELETE
  TO authenticated
  USING (
    public.auth_team_member_can_manage_team()
    AND property_id IS NOT DISTINCT FROM public.auth_team_member_property_id()
  );
