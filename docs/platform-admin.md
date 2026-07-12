# One Eyrie Platform Admin Portal

Internal SaaS operations console at `/admin` — separate from the hotel-facing application.

## Status

| Stage | Scope | Status |
|-------|-------|--------|
| A | Database schema, platform admin RLS, property ID sequence | **Complete** (migrations 037–040 applied; owner seeded manually) |
| B | Server-side `resolvePlatformAdminRequest` helper | **Complete** |
| C | Protected `/admin` layout + route guard | **Complete** |
| D | Organizations/properties list + detail | **Complete** |
| E | Organization/property creation | **Complete** |
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

## Stage B — Server authorization helper

| File | Purpose |
|------|---------|
| `app/lib/platform-admin/types.ts` | Platform admin types |
| `app/lib/platform-admin/server/resolve-platform-admin-request.ts` | `resolvePlatformAdminRequest()`, fail-closed 401/403 |
| `app/lib/platform-admin/admin-fetch.ts` | Client Bearer fetch for `/api/admin/*` |
| `app/api/admin/me/route.ts` | Auth probe for platform administrators |

Verification (requires `npm run dev` or `SMOKE_BASE_URL`):

```bash
node scripts/tenant/verify-platform-admin-stage-b.mjs
```

## Stage C — Protected `/admin` layout

| File | Purpose |
|------|---------|
| `app/admin/layout.tsx` | Admin portal layout + `AdminAccessGate` |
| `app/admin/components/AdminAccessGate.tsx` | Server-validated gate via `GET /api/admin/me` |
| `app/admin/components/AdminShell.tsx` | Separate admin shell (no hotel sidebar) |
| `app/admin/components/AdminHeader.tsx` | “One Eyrie Admin” header |
| `app/admin/components/AdminAccessDenied.tsx` | Dedicated access-denied view |
| `app/admin/access-denied/page.tsx` | `/admin/access-denied` route |
| `app/admin/page.tsx` | Minimal admin home placeholder |
| `app/lib/platform-admin/admin-paths.ts` | Admin path helpers |

Minimal hotel-app touchpoints (login redirect + route guard bypass only):

- `app/lib/login-return.ts` — accept `/admin` as `?next=` target
- `app/login/page.tsx` — honor admin post-login redirect
- `app/lib/role-permissions.ts` + `RoleRouteGuard.tsx` — skip hotel module guard on `/admin/*`

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-c.mjs
```

## Stage D — Organizations and properties list/detail

| File | Purpose |
|------|---------|
| `app/api/admin/dashboard/route.ts` | Dashboard counts + organization list |
| `app/api/admin/organizations/route.ts` | Organization list |
| `app/api/admin/organizations/[id]/route.ts` | Organization detail |
| `app/api/admin/properties/[id]/route.ts` | Property detail |
| `app/lib/platform-admin/server/admin-organizations.ts` | Service-role data loaders |
| `app/lib/platform-admin/server/onboarding-status.ts` | Derived onboarding status |
| `app/admin/page.tsx` | Dashboard UI |
| `app/admin/organizations/page.tsx` | Organizations list |
| `app/admin/organizations/[id]/page.tsx` | Organization detail |
| `app/admin/properties/[id]/page.tsx` | Property detail |

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-d.mjs
```

## Stage E — Organization and property creation

| File | Purpose |
|------|---------|
| `app/api/admin/organizations/route.ts` | `POST` create organization |
| `app/api/admin/organizations/[id]/properties/route.ts` | `POST` create property |
| `app/lib/platform-admin/server/create-organization.ts` | Org insert + module seed + audit |
| `app/lib/platform-admin/server/create-property.ts` | Property insert + audit |
| `app/lib/platform-admin/server/admin-audit-log.ts` | Audit log writer |
| `app/lib/platform-admin/server/admin-slug.ts` | Slug generation/validation |
| `app/admin/organizations/new/page.tsx` | Create organization form |
| `app/admin/organizations/[id]/properties/new/page.tsx` | Create property form |

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-e.mjs
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
