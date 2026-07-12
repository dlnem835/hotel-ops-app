# One Eyrie Platform Admin Portal

Internal SaaS operations console at `/admin` — separate from the hotel-facing application.

## Status

| Stage | Scope | Status |
|-------|-------|--------|
| A | Database schema, platform admin RLS, property ID sequence | **Complete** (migrations 037–040 applied; owner seeded manually) |
| B | Server-side `resolvePlatformAdminRequest` helper | Pending |
| C | Protected `/admin` layout + route guard | Pending |
| D | Organizations/properties list + detail | Pending |
| E | Organization/property creation | Pending |
| F | First-GM invitation + membership | Pending |
| G | Module controls + suspend/reactivate | Pending |
| H | Audit log UI | Pending |
| I | Security verification + smoke tests | Pending |

## Stage A — Database schema

Apply in Supabase SQL editor (or `node scripts/tenant/apply-sql-migration.mjs <file>`):

| # | File | Purpose |
|---|------|---------|
| 037 | `037_platform_admins.sql` | `platform_admins` table |
| 038 | `038_organization_modules_and_invitations.sql` | Modules, invitations, default module seed function |
| 039 | `039_admin_audit_log.sql` | `admin_audit_log` table |
| 040 | `040_platform_admin_rls.sql` | `auth_user_is_platform_admin()`, RLS, `properties_id_seq` |
| 041 | `041_platform_owner_seed.sql` | **Manual** — insert your `auth.users.id` as `platform_owner` |

### Platform owner seed (manual)

After applying 037–040, run in Supabase SQL editor:

```sql
INSERT INTO platform_admins (user_id, role, active, created_by)
VALUES (
  'YOUR_AUTH_USER_UUID'::uuid,
  'platform_owner',
  true,
  NULL
)
ON CONFLICT (user_id) DO NOTHING;
```

Do not auto-promote the first registered user. Do not hardcode emails or usernames in migrations.

### Property IDs

Migration 040 creates `properties_id_seq` initialized to `MAX(properties.id)`. The pilot property (`id = 1`) is preserved; `nextval('properties_id_seq')` returns `MAX(id) + 1`.

### Organization modules

`seed_default_organization_modules(organization_id)` enables all current modules:

`dashboard`, `reports`, `lost_found`, `pass_on`, `inspections`, `maintenance`, `settings`

Pilot org (`id = 1`) is backfilled on migration 038. Future org creation (Stage E) will call the same function.

### Rollback

```bash
# Supabase SQL editor — review first
scripts/tenant/rollback-platform-admin.sql
```

### Verification

```bash
node scripts/tenant/verify-platform-admin-stage-a.mjs
```

## Authorization model (permanent)

- Valid Supabase session **and** active `platform_admins` row required
- Server-side check on every `/api/admin/*` route (Stage B+)
- Hotel `organization_users` / `user_properties` roles do **not** grant admin access
- Service role never exposed to browser

## Onboarding workflow (Stages E–F)

1. Create organization
2. Create first property
3. Invite first GM (name + email) via Supabase `inviteUserByEmail()`
4. Assign enabled modules
5. Finish — GM completes hotel setup in existing Settings

GM login uses real email (not `@oneeyrie.local`).

## Related docs

- [tenant-migration.md](./tenant-migration.md) — hotel multi-tenant architecture
