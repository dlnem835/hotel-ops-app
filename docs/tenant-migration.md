# One Eyrie Multi-Tenant Migration

Permanent commercial architecture: **Organization → Properties → Memberships → Operational data**.

This document covers Checkpoint 1 (review artifacts) and Checkpoint 2 (apply plan). No application code, API, RLS, storage, or UI changes occur until later checkpoints.

## Checkpoint 1 Status — Complete

Checkpoint 1 is **complete** (commit `checkpoint-1-multi-tenant-preparation`).

| Deliverable | Location | Status |
|-------------|----------|--------|
| Live baseline (sample-row inventory) | `supabase/migrations/history/000_live_baseline_pass_on_lost_items_team_members.sql` | Done |
| Constraint/RLS supplement | `supabase/migrations/history/000_live_baseline_supplement_constraints.sql` | Done |
| Exact pg_dump DDL | Same path via `export-live-ddl.mjs` | **Blocked** — needs `SUPABASE_DB_URL` |
| Review migrations 026–033 | `supabase/migrations/026_*.sql` … `033_*.sql` | Done — **all applied** (Checkpoint 2 schema complete) |
| Pre-migration row counts | `scripts/tenant/snapshots/row-counts-checkpoint1-before.json` | Done |
| Row-count script | `scripts/tenant/verify-row-counts.mjs` | Done |
| Null-tenant verification | `scripts/tenant/verify-null-tenant-columns.sql` | Done |
| Rollback script | `scripts/tenant/rollback-checkpoint2.sql` | Done |

### Pre-migration row counts (2026-07-11)

| Table | Count |
|-------|------:|
| team_members | 22 |
| pass_on_log | 33 |
| pass_on_log_replies | 14 |
| pass_on_log_views | 206 |
| lost_items | 2 |
| hotel_property | 1 |
| buildings_and_areas | 151 |
| work_orders | 17 |
| pm_occurrences | 5 |
| inspection_sessions | 92 |
| scheduled_report_schedules | 0 |

## Pilot tenant (migration 026)

- **Organization id=1:** One Eyrie Pilot Organization (`one-eyrie-pilot`)
- **Property id=1:** Migrated from `hotel_property` (SpringHill Suites Tampa Suncoast Parkway)
- Property IDs remain **INT**; id=1 is preserved for the pilot property.

## Checkpoint 2 apply status

Applied manually in Supabase SQL Editor. App smoke-tested after each step.

| # | File | Supabase status |
|---|------|-----------------|
| 026 | `026_tenant_organizations_properties.sql` | **Applied** — verified |
| 027 | `027_tenant_memberships_backfill.sql` | **Applied** — verified |
| 028 | `028_tenant_columns_nullable.sql` | **Applied** — smoke-tested |
| 029 | `029_tenant_backfill_pilot.sql` | **Applied** — verified |
| 030 | `030_tenant_team_members_and_constraints.sql` | **Applied** — verified |
| 031 | `031_tenant_columns_not_null.sql` | **Applied** — smoke-tested |
| 032 | `032_tenant_stamp_triggers.sql` | **Applied** — smoke-tested |
| 033 | `033_hotel_property_compat_view.sql` | **Applied** — Checkpoint 2 complete |

**Checkpoint 2 schema migrations (026–033) are complete.** Application tenant wiring continues in Checkpoints 3–8.

## Migration apply order (Checkpoint 2)

Apply in strict order via Supabase SQL editor. One migration at a time; smoke-test after each.

| # | File | Purpose |
|---|------|---------|
| 026 | `026_tenant_organizations_properties.sql` | Create `organizations`, `properties`; seed from `hotel_property` |
| 027 | `027_tenant_memberships_backfill.sql` | Create `organization_users`, `user_properties`; backfill from `team_members` |
| 028 | `028_tenant_columns_nullable.sql` | Add nullable `organization_id` / `property_id` columns |
| 029 | `029_tenant_backfill_pilot.sql` | Backfill org=1, property=1 on all tenant rows |
| 030 | `030_tenant_team_members_and_constraints.sql` | `team_members` org columns; per-property area names; repoint FKs |
| 031 | `031_tenant_columns_not_null.sql` | Enforce NOT NULL after verification |
| 032 | `032_tenant_stamp_triggers.sql` | Child-table tenant stamp triggers |
| 033 | `033_hotel_property_compat_view.sql` | Temporary `hotel_property_compat` view (removed Checkpoint 8) |

## Checkpoint 2 verification procedure

1. **Before apply:** capture row counts
   ```bash
   node scripts/tenant/verify-row-counts.mjs --out scripts/tenant/snapshots/row-counts-checkpoint2-before.json
   ```

2. **Apply 026 → 033** in order (one migration at a time).

3. **After 029, before 031:** run null check (all counts must be 0)
   ```bash
   # Supabase SQL editor or psql:
   # scripts/tenant/verify-null-tenant-columns.sql
   ```

4. **After full apply:** capture row counts again; counts must match pre-migration for operational tables
   ```bash
   node scripts/tenant/verify-row-counts.mjs --all --out scripts/tenant/snapshots/row-counts-checkpoint2-after.json
   ```

5. **Spot checks:**
   - `SELECT * FROM organizations WHERE id = 1;`
   - `SELECT * FROM properties WHERE id = 1;`
   - `SELECT count(*) FROM organization_users;` (login users from `team_members`)
   - `SELECT count(*) FROM user_properties;`

## Rollback

If Checkpoint 2 migrations were applied and must be reversed:

```bash
# Supabase SQL editor or psql — review script first
scripts/tenant/rollback-checkpoint2.sql
```

Rollback drops tenant columns, membership tables, and root tenant tables. Operational row data is preserved; tenant stamp values are discarded.

## Live DDL export (recommended before Checkpoint 2)

Sample-row export does not capture exact constraints, indexes, defaults, or RLS. For full baseline:

1. Add to `.env.local`:
   ```
   SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
   ```
   (Supabase Dashboard → Project Settings → Database → Connection string)

2. Run:
   ```bash
   node scripts/tenant/export-live-ddl.mjs
   ```

This overwrites `000_live_baseline_pass_on_lost_items_team_members.sql` with exact `CREATE TABLE`, indexes, and policies.

## What Checkpoint 1 did NOT change

- No migrations applied to Supabase
- No production data modified
- No application code, queries, APIs, RLS policies, storage paths, or UI

## Later checkpoints (after Checkpoint 2 approval)

| Checkpoint | Scope |
|------------|-------|
| 3 | `PropertyContextProvider` + property selector in sidebar |
| 4 | API session auth + tenant-scoped queries |
| 5 | RLS + storage path isolation |
| 6 | Reports + scheduled reports isolation |
| 7 | Admin property/membership UI |
| 8 | Test orgs/properties; remove `hotel_property` compat |

## Legacy removal criteria (Checkpoint 8)

- All API routes enforce session auth and tenant scope
- RLS policies replace permissive `USING (true)` on tenant tables
- No application reads/writes to `hotel_property` table
- Drop `hotel_property_compat` view and `hotel_property` table
