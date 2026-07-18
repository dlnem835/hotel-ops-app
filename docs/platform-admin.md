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
| Pre-F | Organization lifecycle (suspend/reactivate/test delete) | **Complete** |
| F | First-GM invitation + membership | **Complete** |
| G | Module controls | **Complete** |
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
| `app/admin/components/AdminTimezoneSelect.tsx` | Searchable IANA timezone control |
| `app/lib/timezones.ts` | Supported IANA allow-list, labels, validation |

### Property timezone

Timezone belongs to the **property**, not permanently to the user or organization.

- Create-property UI uses a searchable dropdown of curated IANA identifiers with
  friendly labels (e.g. `Eastern Time — America/New_York`). The database stores
  only the IANA id (`America/New_York`).
- Default: first existing property timezone in the organization when available
  and supported; otherwise `America/New_York` (pilot default).
- Platform admins can change the selection before creating the property.
- `POST /api/admin/organizations/[id]/properties` rejects any timezone not on
  the supported allow-list (`400`).
- Tenant context already exposes `activeProperty.timezone` and each
  `properties[].timezone` from `resolveTenantContextForUser`. When a user
  switches properties, consumers must use the active property’s timezone for
  property-scoped date/time calculations.

#### Later timezone-hardening checkpoint

The following still hardcode or rely on browser-local formatting rather than
`activeProperty.timezone`. Do **not** treat this as complete multi-property TZ
support yet:

| Area | Notes |
|------|--------|
| `app/lib/hotel-business-date.ts` | Hardcodes `HOTEL_TIMEZONE = "America/New_York"` for Pass-On business dates |
| Pass-On Log (desktop + mobile) | Uses `hotel-business-date` / `toLocaleString` without active property TZ |
| Maintenance / PM / work orders | Various `Date` + `toLocale*` helpers; not wired to active property TZ |
| Inspections | Period/age/duration utilities use local or hardcoded logic |
| Lost & Found page | Client `toLocale*` / local `Date` formatting |
| Reports (filters, schedules, outputs) | Mix of schedule TZ fields and browser/`new Date()` formatting |
| Dashboard date helpers | `app/dashboard/lib/date-utils.ts` browser-oriented |
| Admin portal tables | Display timestamps via `toLocaleString()` (admin UX only) |

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-e.mjs
```

## Pre-Stage F — Organization lifecycle

| File | Purpose |
|------|---------|
| `app/api/admin/organizations/[id]/suspend/route.ts` | Suspend active organization |
| `app/api/admin/organizations/[id]/reactivate/route.ts` | Reactivate suspended organization |
| `app/api/admin/organizations/[id]/route.ts` | `DELETE` test organization (platform_owner) |
| `app/lib/platform-admin/server/organization-lifecycle.ts` | Suspend, reactivate, delete |
| `app/lib/platform-admin/server/organization-delete-eligibility.ts` | Empty-org checks |
| `app/admin/components/AdminOrganizationLifecycleActions.tsx` | Org detail lifecycle UI |
| `app/admin/components/AdminConfirmNameModal.tsx` | Typed-name delete confirmation |

Pilot org `id = 1` cannot be suspended or deleted. Only `active` and `suspended` statuses are used. Permanent deletion requires `platform_owner`, exact name confirmation, and zero related records.

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-e-lifecycle.mjs
```

## Stage F — Property Administrators (multiple admins) + membership

Organizations and properties are **not** limited to a single administrator. Any
number of administrators can be invited at any time within the same organization
(no new organization required). Each invitation has a durable lifecycle, audit
trail, and membership rows that scale from one property to many properties to the
entire organization without a permission-model redesign.

| File | Purpose |
|------|---------|
| `app/api/admin/organizations/[id]/invitations/route.ts` | Create/list administrator invitations |
| `app/api/admin/organizations/[id]/invitations/[invitationId]/route.ts` | Per-invite actions: resend, cancel, disable, enable, remove, send password reset |
| `app/api/invitations/complete/route.ts` | Complete pending invitation after login |
| `app/lib/platform-admin/roles.ts` | Org/property role constants + display labels + invite-role mapping |
| `app/lib/platform-admin/server/create-gm-invitation.ts` | `createAdministratorInvitation` + `fetchOrganizationInvitations` (lazy-expire, derived active) + `canInviteAdministrator` |
| `app/lib/platform-admin/server/manage-administrator-invitation.ts` | Invitation lifecycle actions (audit-logged, primary-protected where applicable) |
| `app/lib/platform-admin/server/complete-gm-invitation.ts` | Membership + team_members provisioning |
| `app/lib/platform-admin/server/gm-module-permissions.ts` | Cap admin permissions by org modules |
| `app/admin/components/AdminInviteAdministratorForm.tsx` | Always-on **Invite Administrator** form (role + optional job title) |
| `app/admin/components/AdminAdministratorsTable.tsx` | **Property Administrators** table with per-row actions |
| `app/lib/login-email.ts` | Username or real-email login resolution |
| `app/lib/invitations/complete-pending-invitation.ts` | Client helper after login |

### Multiple administrators per organization and property

- **Invite Administrator** is always available for active organizations with at
  least one property (`canInviteAdministrator`).
- Additional administrators can be invited after onboarding is complete.
- The first administrator per organization becomes the **Primary Owner**
  (`org_owner`, `is_primary = true`). Subsequent invites choose:
  - **Organization Admin** (`org_admin`) — org-wide access to every active property.
  - **Property Administrator** (`org_member` + `user_properties` row) — scoped to
    the selected property; multiple property rows can be added later without
    redesigning the model.
- Pending-email uniqueness is scoped per organization (not global), so the same
  person can be re-invited after cancel/revoke/expire.

### Primary Administrator protection

- The Primary Owner is durable via `organization_invitations.is_primary` and is
  **protected from Disable and Remove** (returns 409).
- **Transfer Primary Administrator** is a future stage; removal of the current
  primary is blocked until transfer exists.
- Primary administrators **can** receive **Send Password Reset** and pending
  primaries **can** receive **Resend Invite**.

### Invitation lifecycle

| Stage | Status | Platform-admin actions |
|-------|--------|------------------------|
| Invited | `pending` | **Resend Invite**, **Cancel** |
| Expired (7-day TTL) | `expired` | **Resend Invite**, **Cancel** |
| Accepted | `accepted` | **Edit**, **Send Password Reset**, **Disable** / **Enable**; **Remove** (platform owner only; under More actions). Primary Owner: Edit + password reset; Transfer ownership required instead of Disable/Remove |
| Cancelled | `cancelled` | — |
| Removed | `revoked` | — |

Flow:

1. **Invite** — platform admin sends invitation (`invitation.created` audit).
2. **Resend Invite** — re-sends Supabase invite email, resets TTL (`invitation.resent`).
3. **Cancel** — pending/expired → cancelled (`invitation.cancelled`).
4. **Accept** — invited user signs in via link; `/api/invitations/complete`
   provisions memberships (`invitation.accepted`).
5. **Send Password Reset** — accepted administrators receive a Supabase recovery
   email (`administrator.password_reset_sent`).
6. **Disable / Enable** — flips `organization_users.active`, `user_properties.active`,
   and `team_members` login state (`administrator.disabled` / `administrator.enabled`).
7. **Remove** — platform owner only. Requires typed administrator-name
   confirmation. Deletes `organization_users` and this org's `user_properties`
   rows, deactivates related `team_members` login access, and sets invitation
   `revoked` (`administrator.removed`). Preserves operational history and the
   Auth user (account deletion is a separate future workflow). Blocked for
   Primary Owner (409) and for self-targeting the active actor (403).
   Non–platform-owner SaaS actors receive 403.

Disable/Remove are enforced at the tenant data layer (`resolveTenantContextForUser`
requires active memberships; removed users have no remaining org/property rows).

**Auth-email suppression (dev/test only).** Invite, resend, and password-reset
flows go through `app/lib/platform-admin/server/auth-email-dispatch.ts`. When
`SUPPRESS_AUTH_EMAILS` is truthy the flows generate Supabase action links without
dispatching email (and log `Auth email suppressed in development`). It defaults
to false and is unconditionally ignored in production (`NODE_ENV=production`).
Password-reset emails (forgot-password + admin Send Password Reset) resolve the
linked `auth_user_id`, call `generateLink` for that Auth identity, and deliver via
Resend to the invitation **contact** email — never matching Auth by contact email
(avoids `@oneeyrie.local` identity drift). Invitations still use Supabase Auth
mailer when not suppressed.

### Job title (descriptive only)

- Optional on the invite form. Defaults to **Administrator** when blank.
- Examples: General Manager, Assistant General Manager, Area General Manager,
  Regional Director, Corporate Administrator.
- Stored on `team_members.job_title` at completion. **Never affects permissions.**
  Access is governed solely by `is_administrator`, `org_role` / `property_role`,
  and `module_permissions`.

### Roles & scope (scales without redesign)

- **Primary Owner** (`org_owner`) — first admin per org; org-wide (every active
  property). Displayed as "Primary Owner" in the administrators table (no
  duplicate badge).
- **Organization Admin** (`org_admin`) — org-wide (every active property).
- **Property Administrator** (`org_member` + `user_properties` row) —
  property-scoped; can hold multiple properties via multiple rows.

Org-wide access is derived in `resolveTenantContextForUser`: `org_owner`/`org_admin`
reach every active property in the org (including ones added later); `org_member`
reaches only explicit `user_properties` rows.

### Audit actions

`invitation.created`, `invitation.resent`, `invitation.cancelled`,
`invitation.accepted`, `administrator.password_reset_sent`, `administrator.disabled`,
`administrator.enabled`, `administrator.removed`.

### Migration

`supabase/migrations/043_property_administrators.sql`: adds `cancelled` status,
`is_primary` (+ backfill earliest invite per org), and scopes the pending unique
index to `(organization_id, lower(email))`.

Minimal hotel login touchpoint: `/login` accepts username **or** real email and
calls invitation completion after sign-in.

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-f.mjs
node scripts/tenant/verify-platform-admin-administrator-remove.mjs
```

## Stage G — Module controls

| File | Purpose |
|------|---------|
| `app/api/admin/organizations/[id]/modules/route.ts` | `GET` / `PATCH` org module entitlements |
| `app/lib/platform-admin/organization-module-keys.ts` | Shared module key constants |
| `app/lib/platform-admin/server/organization-modules.ts` | Parse/update modules, cap membership permissions |
| `app/admin/components/AdminModuleControls.tsx` | Module toggle UI on org detail |

Disabling a module updates `organization_modules`, caps `user_properties.module_permissions` and `team_members.module_permissions` for that org, and writes `modules.updated` audit when changes occur.

Verification:

```bash
node scripts/tenant/verify-platform-admin-stage-g.mjs
```

## First-login account setup (invited users)

Invited GMs must complete a required first-login setup before receiving hotel
access. Enforcement is **server-side at the tenant data layer** (Option A).

| File | Purpose |
|------|---------|
| `supabase/migrations/042_invited_account_setup.sql` | `user_profiles` table + partial-unique username index + incomplete-invite backfill |
| `app/lib/account-setup/username.ts` | Username normalization/validation + password rules |
| `app/lib/account-setup/server/account-setup-state.ts` | Server setup-state reader (missing row = complete) |
| `app/lib/account-setup/server/complete-account-setup.ts` | Finalizes setup; canonicalizes login identity |
| `app/api/onboarding/account/route.ts` | `GET` state / `POST` complete |
| `app/onboarding/account/page.tsx` | Required setup form (name, username, password, appearance) |
| `app/auth/callback/page.tsx` | Invite landing → complete invitation → redirect to setup |
| `app/lib/account-setup/account-setup-client.ts` | Client setup-state fetch + `/onboarding/account` path |

Behavior:

- Invitation `redirectTo` is `/auth/callback`. Invitation completion writes a
  `user_profiles` row with `account_setup_completed = false`.
- `resolveTenantRequest()` and `/api/tenant/context` return **403** for
  authenticated users whose setup is incomplete. This is the security boundary.
- `RoleRouteGuard` redirects incomplete users to `/onboarding/account` for UX
  only; it is not relied on for security.
- Setup requires first/last name, username, password + confirmation
  (min 8 chars), and appearance (default Dark). Password is set client-side via
  `supabase.auth.updateUser` and never sent to or stored by app tables/logs.
- Username is normalized (lowercase, `a-z0-9._-`, 3–32) and globally unique via
  `user_profiles.username_normalized`. On completion the login identity is
  canonicalized to `<username>@oneeyrie.local`, preserving username login
  compatibility without exposing that format to the user.
- Existing users are unaffected: absence of a `user_profiles` row means complete.
  The migration only backfills genuinely-incomplete accepted invitations
  (`team_members.username IS NULL`).

Light Mode is experimental and authorized to a single platform-owner account by
`auth.users.id` UUID only — not username, email, hotel/organization role, or
`platform_admin` status. The UUID is held in the **server-only** env var
`LIGHT_MODE_ALLOWED_USER_ID` and is never exposed to the client (no
`NEXT_PUBLIC_*`). The decision lives in one place,
`app/lib/theme/server/light-mode-access.ts` (`isLightModeAllowedForUser`), and is
delivered to the client as a plain boolean via `GET /api/theme/light-mode`,
revalidated on every session load. Everyone else stays in Dark Mode, never sees
the Appearance control, and any stored/altered `light` value resolves to Dark
(`resolveEffectiveTheme`). Setup completion also coerces `light` to Dark
server-side for non-authorized users. To later release Light Mode to all users,
change `isLightModeAllowedForUser` to return `true` — no theme-system rewrite.

Set the env var in `.env.local` (server-only):

```bash
LIGHT_MODE_ALLOWED_USER_ID=<your-auth-user-uuid>
```

> **Future hardening (not in this stage):** full cookie-based server *page*
> gating via `@supabase/ssr` + a root `proxy.ts` (Next.js 16 renamed Middleware
> to Proxy). This stage keeps the existing bearer-token + localStorage session
> model and enforces incomplete-account protection at the data layer only.

Verification (requires dev server + migration 042 applied):

```bash
node scripts/tenant/verify-invited-account-setup.mjs
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
