-- Supplement to 000_live_baseline_pass_on_lost_items_team_members.sql
-- Documents constraints, indexes, and RLS from repo migrations affecting live-only tables.
-- DO NOT APPLY — reference only.

-- ── team_members (pre-019 base inferred from app usage + migration 015/019) ──
-- migration 015: job_title, is_administrator, module_permissions
-- migration 019: property_id INT NOT NULL DEFAULT 1 → FK hotel_property(id)
-- migration 019: RLS policies team_members_select_same_property, team_managers_*
-- migration 019: helpers auth_team_member_property_id(), auth_team_member_can_manage_team()

-- ── pass_on_log_replies ──
-- migration 016: ADD COLUMN edited_at TIMESTAMPTZ

-- ── pass_on_log / pass_on_log_replies RLS ──
-- migration 017: pass_on_can_manage_author(stored_author text) SECURITY DEFINER
-- migration 017 policies:
--   Authors and admins can delete pass_on_log
--   Authors can update pass_on_log
--   Authors and admins can delete pass_on_log_replies
--   Authors and admins can update pass_on_log_replies
-- NOTE: SELECT/INSERT policies for pass_on_log* are not defined in repo migrations 001-025.

-- ── lost_items ──
-- migration 023: status value 'Discarded' (data migration from 'Closed')

-- ── pass_on_log_views ──
-- Unique constraint inferred from app upsert onConflict entry_id,auth_user_id
