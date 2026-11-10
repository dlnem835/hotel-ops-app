# Shipping-labels guest privacy (separate from Security Fix #3)

Do not treat this as part of Phase B or migration 069. Do not change shipping
functionality in the Phase A/B photo worktree.

## Current state

There are two label buckets:

| Bucket | Public? | Used by current shipping |
|---|---|---|
| `shipping-labels` | **Yes** | Legacy guest prepaid-label upload (`/label`, `/api/upload-label`) |
| `lost-found-shipping-labels` | No | Current Lost & Found purchased labels |

`/api/upload-label` now returns **410** and tells guests to use the tokenized
`/shipping-request/[token]` flow. Application code no longer writes to
`shipping-labels`. Purchased labels are stored privately and served with
signed URLs.

The public `shipping-labels` bucket and its 036 policies remain in live
Supabase.

## Guest privacy risks

1. **Anonymous object URLs.** `shipping-labels` is `public = true`, so
   `/storage/v1/object/public/shipping-labels/<path>` does not require a
   One Eyrie login. A caller who knows or can guess an object path can fetch
   the file.
2. **Guessable legacy paths.** 036 guest uploads used
   `org-{organizationId}/property-{propertyId}/{lostItemId}-...`. Organization,
   property, and lost-item ids are small integers, so historical labels may be
   enumerable.
3. **PII on labels.** Carrier labels typically include guest name, address, and
   tracking data. Those files remaining in a public bucket are a privacy
   exposure even though new uploads are disabled.
4. **Anonymous INSERT still allowed by RLS.** 036 still grants
   `INSERT TO anon, authenticated` when
   `auth_guest_can_upload_shipping_label(name)` matches a `lost_items` id.
   The app route is 410, but a direct Storage API call with the anon key could
   still upload if that helper matches.
5. **Cross-tenant legacy SELECT.** `auth_legacy_storage_read_allowed` lets any
   authenticated user with any active property SELECT unprefixed objects in
   this bucket. That hole is being removed from inspection/work-order photos
   in 069; it is **not** removed here.

Current purchased-label flow is already on the private bucket and is out of
this finding, except that staff emails still receive time-limited signed URLs.

## Recommended separate remediation (do not implement now)

1. Inventory whether any live objects remain in `shipping-labels`.
2. Confirm no in-app or email link still uses `/object/public/shipping-labels/`.
3. Add a dedicated migration (after 069, not instead of it) that:
   - Sets `shipping-labels` `public = false`.
   - Drops anon SELECT and anon INSERT on that bucket.
   - Restricts authenticated SELECT to `auth_user_can_access_storage_path`.
   - Leaves `lost-found-shipping-labels` unchanged.
4. Keep `/api/upload-label` disabled. Serve any remaining legacy files through
   a tenant-authenticated signed URL, or leave them inaccessible if they are
   unused.
5. Manually test guest checkout, hotel print/email of purchased labels, and
   denial of public object URLs before applying the shipping migration.

Rollback for that future migration would restore `public = true` and the 036
shipping-labels policies only. Do not fold this into operational photo 069.
