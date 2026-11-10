/**
 * Operational photo access (Security Fix #3 Phase A + Phase B prep).
 *
 * Covers parse/canonicalize, tenant prefix checks, write rejection of
 * tokens and foreign refs, legacy parent gating, fail-closed signed
 * display URLs (no public fallback), and static wiring including the
 * unapplied 069 migration file.
 *
 * Usage: npx tsx scripts/tenant/verify-operational-photo-access.ts
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessOperationalPhoto,
  canonicalizeOperationalPhotoRef,
  collectKnownLegacyPhotoPaths,
  isLegacyUnprefixedOperationalPhoto,
  isOperationalPhotoParent,
  parseOperationalPhotoRef,
  photoRefKey,
  refreshOperationalPhotoDisplayUrl,
  requireCanonicalOperationalPhotoForWrite,
  resolveOperationalPhotoDisplayUrl,
} from "@/app/lib/storage/server/operational-photo-access";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

const root = process.cwd();
const host = "https://example.supabase.co";
const scope = { organizationId: 1, propertyId: 1 };

function publicUrl(bucket: string, objectPath: string): string {
  return `${host}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function signedUrl(bucket: string, objectPath: string): string {
  return `${host}/storage/v1/object/sign/${bucket}/${objectPath}?token=secret-token`;
}

function assertRejectsWrite(
  value: string,
  message: string,
  options?: {
    existingRefs?: Array<string | null | undefined>;
    defaultBucket?: "inspection-photos" | "work-order-photos";
    writeScope?: { organizationId: number; propertyId: number };
  }
) {
  try {
    requireCanonicalOperationalPhotoForWrite(value, options?.writeScope || scope, {
      defaultBucket: options?.defaultBucket || "work-order-photos",
      existingRefs: options?.existingRefs || [],
      fieldName: "photo_url",
    });
    assert.fail(message);
  } catch (error) {
    assert.ok(
      error instanceof TenantRequestError,
      `${message}: expected TenantRequestError`
    );
    assert.strictEqual((error as TenantRequestError).status, 400, message);
  }
}

function runParseTests() {
  const prefixed = parseOperationalPhotoRef(
    publicUrl("inspection-photos", "org-1/property-1/inspections/12/cat--item/1.jpg")
  );
  assert.ok(prefixed, "parses prefixed public inspection URL");
  assert.strictEqual(prefixed?.bucket, "inspection-photos");
  assert.strictEqual(
    prefixed?.path,
    "org-1/property-1/inspections/12/cat--item/1.jpg"
  );
  assert.strictEqual(prefixed?.organizationId, 1);
  assert.strictEqual(prefixed?.propertyId, 1);

  const legacy = parseOperationalPhotoRef(
    publicUrl("inspection-photos", "38/fail.jpg")
  );
  assert.ok(legacy, "parses legacy unprefixed public URL");
  assert.strictEqual(legacy?.path, "38/fail.jpg");
  assert.strictEqual(legacy?.organizationId, null);
  assert.strictEqual(legacy?.propertyId, null);

  const signed = parseOperationalPhotoRef(
    signedUrl("work-order-photos", "org-1/property-1/manual/9.jpg")
  );
  assert.ok(signed, "parses signed work-order URL");
  assert.strictEqual(signed?.kind, "signed-url");
  assert.strictEqual(signed?.path, "org-1/property-1/manual/9.jpg");

  const pathOnly = parseOperationalPhotoRef(
    "org-1/property-1/pm/4/step/2.jpg",
    { defaultBucket: "inspection-photos" }
  );
  assert.ok(pathOnly, "parses raw storage path with default bucket");
  assert.strictEqual(pathOnly?.kind, "storage-path");

  const tagged = parseOperationalPhotoRef(
    "inspection-photos|org-1/property-1/inspections/12/a.jpg",
    { defaultBucket: "work-order-photos" }
  );
  assert.ok(tagged, "parses bucket-tagged canonical ref");
  assert.strictEqual(tagged?.bucket, "inspection-photos");
  assert.strictEqual(tagged?.path, "org-1/property-1/inspections/12/a.jpg");

  assert.strictEqual(
    parseOperationalPhotoRef("https://evil.example/storage/v1/object/public/inspection-photos/x.jpg"),
    null,
    "rejects non-Supabase hosts"
  );
  assert.strictEqual(
    parseOperationalPhotoRef(publicUrl("pass-on-attachments", "org-1/property-1/x.pdf")),
    null,
    "rejects buckets outside the operational photo allowlist"
  );
}

function runCanonicalizeTests() {
  const signed = signedUrl(
    "inspection-photos",
    "org-1/property-1/inspections/12/item/1.jpg"
  );
  const canonical = canonicalizeOperationalPhotoRef(signed, {
    defaultBucket: "inspection-photos",
  });
  assert.strictEqual(
    canonical,
    "org-1/property-1/inspections/12/item/1.jpg"
  );
  assert.ok(!String(canonical).includes("token="), "canonical path has no token");

  const leftoverToken = canonicalizeOperationalPhotoRef(
    "https://not-storage.example/file?token=abc"
  );
  assert.strictEqual(leftoverToken, null, "unparseable signed-looking URL is dropped");

  const publicCanonical = canonicalizeOperationalPhotoRef(
    publicUrl("work-order-photos", "org-1/property-1/manual/9.jpg"),
    { defaultBucket: "work-order-photos" }
  );
  assert.strictEqual(publicCanonical, "org-1/property-1/manual/9.jpg");

  const taggedWhenBucketUnknown = canonicalizeOperationalPhotoRef(
    publicUrl("work-order-photos", "org-1/property-1/manual/9.jpg")
  );
  assert.strictEqual(
    taggedWhenBucketUnknown,
    "work-order-photos|org-1/property-1/manual/9.jpg",
    "without a default bucket, the stored ref keeps the bucket"
  );

  const crossBucket = canonicalizeOperationalPhotoRef(
    signedUrl("inspection-photos", "org-1/property-1/inspections/12/a.jpg"),
    { defaultBucket: "work-order-photos" }
  );
  assert.strictEqual(
    crossBucket,
    "inspection-photos|org-1/property-1/inspections/12/a.jpg",
    "stores bucket-tagged ref when the default bucket differs"
  );
  assert.ok(!String(crossBucket).includes("token="), "tagged ref has no token");
}

function runWriteRejectionTests() {
  const persisted = requireCanonicalOperationalPhotoForWrite(
    signedUrl("work-order-photos", "org-1/property-1/manual/9.jpg"),
    scope,
    { defaultBucket: "work-order-photos", existingRefs: [], fieldName: "photo_url" }
  );
  assert.strictEqual(persisted, "org-1/property-1/manual/9.jpg");
  assert.ok(!String(persisted).includes("token="), "write path never persists a token");

  assertRejectsWrite(
    "https://not-storage.example/file?token=abc",
    "rejects unparseable signed URL instead of persisting it"
  );
  assertRejectsWrite(
    signedUrl("work-order-photos", "org-83/property-8/manual/9.jpg"),
    "rejects cross-tenant prefixed signed URL on write"
  );
  assertRejectsWrite(
    signedUrl("work-order-photos", "org-1/property-2/manual/9.jpg"),
    "rejects cross-property prefixed signed URL on write"
  );
  assertRejectsWrite(
    "38/fail.jpg",
    "rejects a new unprefixed legacy path that is not already on the parent",
    { defaultBucket: "inspection-photos" }
  );

  const historical = requireCanonicalOperationalPhotoForWrite(
    "38/fail.jpg",
    scope,
    {
      defaultBucket: "inspection-photos",
      existingRefs: [publicUrl("inspection-photos", "38/fail.jpg")],
      fieldName: "photo_url",
    }
  );
  assert.strictEqual(
    historical,
    "38/fail.jpg",
    "re-saving an already-attached legacy photo is allowed"
  );

  assertRejectsWrite(
    "39/other.jpg",
    "rejects a manipulated legacy path that is not on the parent",
    {
      defaultBucket: "inspection-photos",
      existingRefs: ["38/fail.jpg"],
    }
  );
}

function runAccessTests() {
  const prefixed = parseOperationalPhotoRef(
    publicUrl("inspection-photos", "org-1/property-1/inspections/12/a.jpg")
  );
  assert.ok(prefixed);
  assert.strictEqual(
    canAccessOperationalPhoto(prefixed, scope, {}),
    true,
    "prefixed photo in the caller tenant is allowed"
  );
  assert.strictEqual(
    canAccessOperationalPhoto(prefixed, { organizationId: 83, propertyId: 8 }, {}),
    false,
    "prefixed photo from another org is denied"
  );
  assert.strictEqual(
    canAccessOperationalPhoto(prefixed, { organizationId: 1, propertyId: 2 }, {}),
    false,
    "prefixed photo from another property is denied"
  );

  const legacy = parseOperationalPhotoRef(
    publicUrl("inspection-photos", "38/fail.jpg")
  );
  assert.ok(legacy);
  assert.strictEqual(
    canAccessOperationalPhoto(legacy, scope, {}),
    false,
    "legacy photo without a parent-known path is denied"
  );
  assert.strictEqual(
    canAccessOperationalPhoto(legacy, scope, {
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        [publicUrl("inspection-photos", "38/fail.jpg")],
        "inspection-photos"
      ),
    }),
    true,
    "legacy photo is allowed only when already stored on the authorized parent"
  );
  assert.strictEqual(
    canAccessOperationalPhoto(legacy, scope, {
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        ["39/other.jpg"],
        "inspection-photos"
      ),
    }),
    false,
    "legacy photo is denied when the parent stores a different path"
  );
  assert.strictEqual(
    photoRefKey(legacy),
    "inspection-photos|38/fail.jpg"
  );

  const mixed = collectKnownLegacyPhotoPaths(
    [
      publicUrl("inspection-photos", "38/fail.jpg"),
      publicUrl("inspection-photos", "org-1/property-1/inspections/12/a.jpg"),
    ],
    "inspection-photos"
  );
  assert.ok(mixed.has("inspection-photos|38/fail.jpg"));
  assert.ok(
    !mixed.has("inspection-photos|org-1/property-1/inspections/12/a.jpg"),
    "prefixed photos are authorized by tenant prefix, not the legacy allowlist"
  );
  assert.ok(isLegacyUnprefixedOperationalPhoto(legacy));
  assert.ok(!isLegacyUnprefixedOperationalPhoto(prefixed));
}

function runParentTypeTests() {
  assert.ok(
    isOperationalPhotoParent({ type: "inspection_session", id: 12 }),
    "accepts inspection parent"
  );
  assert.ok(
    isOperationalPhotoParent({ type: "work_order", id: 4 }),
    "accepts work-order parent"
  );
  assert.ok(
    isOperationalPhotoParent({ type: "pm_occurrence", id: 9 }),
    "accepts PM parent"
  );
  assert.strictEqual(
    isOperationalPhotoParent({ type: "inspection_session", id: 0 }),
    false,
    "rejects invalid parent id"
  );
  assert.strictEqual(
    isOperationalPhotoParent({ type: "lost_item", id: 1 }),
    false,
    "rejects unrelated parent types"
  );
}

type MockStorageRow = {
  organizationId: number;
  propertyId: number;
  inspectionId?: number;
  inspectionPhotos?: string[];
  workOrderId?: number;
  workOrder?: { photo_url?: string | null; resolution_photo_url?: string | null };
  workOrderPhotos?: Array<{ photo_url?: string | null; storage_path?: string | null }>;
  pmOccurrenceId?: number;
  pmResponses?: {
    targetPhotoUrl?: string | null;
    steps?: Array<{ photoUrl?: string | null }>;
  };
  signError?: string;
};

function createPhotoAccessMock(row: MockStorageRow): SupabaseClient {
  function tableQuery(table: string) {
    const filters: Record<string, unknown> = {};
    const matchesTenant = () =>
      Number(filters.organization_id) === row.organizationId &&
      Number(filters.property_id) === row.propertyId;

    const result = () => {
      if (!matchesTenant()) return { data: table === "work_orders" || table === "pm_occurrences" ? null : [], error: null };

      if (table === "inspection_item_responses") {
        if (Number(filters.inspection_id) !== row.inspectionId) {
          return { data: [], error: null };
        }
        return {
          data: (row.inspectionPhotos || []).map((photo_url) => ({ photo_url })),
          error: null,
        };
      }

      if (table === "work_orders") {
        if (Number(filters.id) !== row.workOrderId) return { data: null, error: null };
        return { data: row.workOrder || null, error: null };
      }

      if (table === "work_order_photos") {
        if (Number(filters.work_order_id) !== row.workOrderId) {
          return { data: [], error: null };
        }
        return { data: row.workOrderPhotos || [], error: null };
      }

      if (table === "pm_occurrences") {
        if (Number(filters.id) !== row.pmOccurrenceId) return { data: null, error: null };
        return { data: { responses: row.pmResponses || {} }, error: null };
      }

      return { data: null, error: null };
    };

    const query: Record<string, unknown> = {};
    query.select = () => query;
    query.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return query;
    };
    query.not = () => query;
    query.maybeSingle = async () => {
      const current = result();
      if (Array.isArray(current.data)) {
        return { data: current.data[0] ?? null, error: null };
      }
      return current;
    };
    query.then = (
      onFulfilled: (value: { data: unknown; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result()).then(onFulfilled, onRejected);
    return query;
  }

  return {
    from: (table: string) => tableQuery(table),
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (objectPath: string) => {
          if (row.signError) {
            return { data: null, error: { message: row.signError } };
          }
          return {
            data: {
              signedUrl: signedUrl(bucket, objectPath),
            },
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

async function runLegacyRefreshAndFallbackTests() {
  const legacyPublic = publicUrl("inspection-photos", "38/fail.jpg");
  const known = collectKnownLegacyPhotoPaths([legacyPublic], "inspection-photos");

  const deniedWithoutParent = await refreshOperationalPhotoDisplayUrl(
    {} as SupabaseClient,
    legacyPublic,
    scope,
    null
  );
  assert.strictEqual(
    deniedWithoutParent,
    null,
    "legacy refresh without a parent record is denied"
  );

  const authorized = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      inspectionId: 12,
      inspectionPhotos: [legacyPublic],
    }),
    legacyPublic,
    scope,
    { type: "inspection_session", id: 12 }
  );
  assert.ok(authorized, "authorized parent can refresh a legacy inspection photo");
  assert.ok(
    String(authorized).includes("/object/sign/inspection-photos/38/fail.jpg"),
    "authorized legacy refresh returns a signed URL"
  );
  assert.ok(
    !String(authorized).includes(legacyPublic.split("?")[0]) ||
      String(authorized).includes("token="),
    "authorized legacy refresh does not return the stored public URL"
  );

  const wrongParent = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      inspectionId: 12,
      inspectionPhotos: [legacyPublic],
    }),
    legacyPublic,
    scope,
    { type: "inspection_session", id: 99 }
  );
  assert.strictEqual(
    wrongParent,
    null,
    "legacy refresh with the wrong parent id is denied"
  );

  const wrongPhotoOnParent = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      inspectionId: 12,
      inspectionPhotos: [publicUrl("inspection-photos", "39/other.jpg")],
    }),
    legacyPublic,
    scope,
    { type: "inspection_session", id: 12 }
  );
  assert.strictEqual(
    wrongPhotoOnParent,
    null,
    "legacy refresh is denied when the parent stores a different photo"
  );

  const crossProperty = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      inspectionId: 12,
      inspectionPhotos: [legacyPublic],
    }),
    legacyPublic,
    { organizationId: 1, propertyId: 2 },
    { type: "inspection_session", id: 12 }
  );
  assert.strictEqual(
    crossProperty,
    null,
    "legacy refresh is denied across properties"
  );

  const crossOrg = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      inspectionId: 12,
      inspectionPhotos: [legacyPublic],
    }),
    legacyPublic,
    { organizationId: 83, propertyId: 8 },
    { type: "inspection_session", id: 12 }
  );
  assert.strictEqual(
    crossOrg,
    null,
    "legacy refresh is denied across organizations"
  );

  const workOrderLegacy = publicUrl("work-order-photos", "wo-old.jpg");
  const authorizedWorkOrder = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      workOrderId: 44,
      workOrder: { photo_url: workOrderLegacy, resolution_photo_url: null },
      workOrderPhotos: [],
    }),
    workOrderLegacy,
    scope,
    { type: "work_order", id: 44 }
  );
  assert.ok(authorizedWorkOrder, "authorized parent can refresh a legacy work-order photo");

  const pmLegacy = "pm-old.jpg";
  const authorizedPm = await refreshOperationalPhotoDisplayUrl(
    createPhotoAccessMock({
      organizationId: 1,
      propertyId: 1,
      pmOccurrenceId: 7,
      pmResponses: { targetPhotoUrl: pmLegacy, steps: [] },
    }),
    pmLegacy,
    scope,
    { type: "pm_occurrence", id: 7 },
    { defaultBucket: "inspection-photos" }
  );
  assert.ok(authorizedPm, "authorized parent can refresh a legacy PM photo");

  const failingSigner = createPhotoAccessMock({
    organizationId: 1,
    propertyId: 1,
    inspectionId: 12,
    inspectionPhotos: [legacyPublic],
    signError: "Unable to sign",
  });
  const noLegacyFallback = await resolveOperationalPhotoDisplayUrl(
    failingSigner,
    legacyPublic,
    scope,
    {
      defaultBucket: "inspection-photos",
      knownLegacyPaths: known,
    }
  );
  assert.strictEqual(
    noLegacyFallback,
    null,
    "legacy photos must not fall back to public URLs when signing fails"
  );

  const prefixedPublic = publicUrl(
    "inspection-photos",
    "org-1/property-1/inspections/12/a.jpg"
  );
  const prefixedFallback = await resolveOperationalPhotoDisplayUrl(
    failingSigner,
    prefixedPublic,
    scope,
    { defaultBucket: "inspection-photos" }
  );
  assert.strictEqual(
    prefixedFallback,
    null,
    "prefixed photos must not fall back to public URLs when signing fails"
  );

  const prefixedRefreshSignFailure = await refreshOperationalPhotoDisplayUrl(
    failingSigner,
    prefixedPublic,
    scope,
    { type: "inspection_session", id: 12 }
  );
  assert.strictEqual(
    prefixedRefreshSignFailure,
    null,
    "prefixed refresh does not return a public URL if signing fails"
  );

  const refreshSignFailure = await refreshOperationalPhotoDisplayUrl(
    failingSigner,
    legacyPublic,
    scope,
    { type: "inspection_session", id: 12 }
  );
  assert.strictEqual(
    refreshSignFailure,
    null,
    "legacy refresh does not return a public URL if signing fails"
  );
}

function read(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function runStaticWiringTests() {
  const migration069Path = "supabase/migrations/069_private_operational_photo_storage.sql";
  assert.ok(
    fs.existsSync(path.join(root, migration069Path)),
    "Phase B prepares migration 069 on disk"
  );
  const migration069 = read(migration069Path);
  const forwardSql = stripSqlComments(migration069.split("ROLLBACK")[0]);
  assert.ok(
    /SET\s+public\s*=\s*false/i.test(forwardSql),
    "069 sets inspection-photos and work-order-photos private"
  );
  assert.ok(
    forwardSql.includes("DROP POLICY IF EXISTS tenant_inspection_photos_select"),
    "069 replaces inspection-photos SELECT policy"
  );
  assert.ok(
    forwardSql.includes("DROP POLICY IF EXISTS tenant_work_order_photos_select"),
    "069 replaces work-order-photos SELECT policy"
  );
  assert.ok(
    /FOR SELECT TO authenticated\b/.test(forwardSql),
    "069 SELECT policies are authenticated-only"
  );
  assert.ok(
    !/FOR SELECT TO authenticated,\s*anon/.test(forwardSql),
    "069 does not grant anonymous SELECT on operational photo buckets"
  );
  assert.ok(
    !forwardSql.includes("auth_legacy_storage_read_allowed"),
    "069 removes legacy unprefixed Storage SELECT from operational photo buckets"
  );
  assert.ok(
    !forwardSql.includes("shipping-labels"),
    "069 does not change shipping-labels policies"
  );
  assert.ok(
    !forwardSql.includes("pass-on-attachments") &&
      !forwardSql.includes("lost-found-shipping-labels"),
    "069 does not mention unrelated attachment or shipping buckets"
  );
  assert.ok(
    !/UPDATE\s+storage\.objects/i.test(forwardSql) &&
      !/DELETE\s+FROM\s+storage/i.test(forwardSql) &&
      !/INSERT\s+INTO\s+storage/i.test(forwardSql),
    "069 does not move, rewrite, insert, or delete storage objects"
  );
  assert.ok(
    /WHERE\s+id\s+IN\s*\(\s*'inspection-photos'\s*,\s*'work-order-photos'\s*\)/.test(
      forwardSql
    ),
    "069 bucket update is limited to inspection-photos and work-order-photos"
  );

  const inspectionUpload = read(
    "app/api/inspections/sessions/[id]/item-photo/route.ts"
  );
  const pmUpload = read(
    "app/api/maintenance/pm-occurrences/[id]/item-photo/route.ts"
  );
  const workOrderUpload = read("app/api/work-orders/photo/route.ts");
  assert.ok(
    !inspectionUpload.includes("getPublicUrl"),
    "inspection upload no longer issues public URLs"
  );
  assert.ok(
    !pmUpload.includes("getPublicUrl"),
    "PM upload no longer issues public URLs"
  );
  assert.ok(
    !workOrderUpload.includes("getPublicUrl"),
    "work-order upload no longer issues public URLs"
  );
  assert.ok(
    !inspectionUpload.includes("photoUrl || filePath") &&
      !inspectionUpload.includes("photoUrl: photoUrl ||"),
    "inspection upload does not return a storage path as a display URL"
  );
  assert.ok(
    !pmUpload.includes("photoUrl || filePath") &&
      !pmUpload.includes("photoUrl: photoUrl ||"),
    "PM upload does not return a storage path as a display URL"
  );
  assert.ok(
    !workOrderUpload.includes("photoUrl || data.path") &&
      !workOrderUpload.includes("photoUrl: photoUrl ||"),
    "work-order upload does not return a storage path as a display URL"
  );

  const inspectionDb = read("app/inspections/lib/inspection-db.ts");
  assert.ok(
    inspectionDb.includes("requireCanonicalOperationalPhotoForWrite"),
    "inspection save/complete rejects invalid photo references"
  );

  const workOrderDb = read("app/maintenance/lib/work-order-db.ts");
  assert.ok(
    workOrderDb.includes("requireCanonicalOperationalPhotoForWrite"),
    "work-order writes reject invalid photo references"
  );

  const workOrderPhotosDb = read("app/maintenance/lib/work-order-photos-db.ts");
  assert.ok(
    workOrderPhotosDb.includes("requireCanonicalOperationalPhotoForWrite"),
    "work-order photo insert requires a validated canonical reference"
  );
  assert.ok(
    !workOrderPhotosDb.includes("canonicalUrl || input.photoUrl"),
    "work-order photo insert must not fall back to raw client input"
  );

  const pmDb = read("app/maintenance/lib/pm-occurrence-db.ts");
  assert.ok(
    pmDb.includes("canonicalizePmOccurrenceResponses"),
    "PM writes canonicalize response photo fields"
  );

  const access = read("app/lib/storage/server/operational-photo-access.ts");
  assert.ok(
    !access.includes("publicFallbackUrl") && !access.includes("publicFallback"),
    "operational photo display has no public URL fallback"
  );
  assert.ok(
    !access.includes("allowLegacy"),
    "GET sign-on-read and refresh share knownLegacyPaths instead of allowLegacy"
  );
  const display = read("app/lib/storage/server/operational-photo-display.ts");
  assert.ok(
    display.includes("collectKnownLegacyPhotoPaths"),
    "GET display helpers collect unprefixed parent-known legacy paths"
  );
  assert.ok(
    !display.includes("collectCanonicalPhotoPaths"),
    "GET display helpers do not treat prefixed paths as legacy allowlist entries"
  );
  assert.ok(
    !display.includes("allowLegacy"),
    "GET display helpers no longer use allowLegacy"
  );

  const refreshRoute = read(
    "app/api/storage/operational-photo/refresh/route.ts"
  );
  assert.ok(
    refreshRoute.includes("refreshOperationalPhotoDisplayUrl"),
    "refresh route uses the tenant-scoped helper"
  );
  assert.ok(
    refreshRoute.includes("resolveTenantRequest"),
    "refresh route requires tenant authentication"
  );
  assert.ok(
    refreshRoute.includes('error: "Photo not found"'),
    "refresh denies unknown photos without returning a URL"
  );
  assert.ok(
    !refreshRoute.includes("signedUrl") || refreshRoute.includes("photoUrl: signedUrl"),
    "refresh success payload uses photoUrl, not a leaked token field name from storage"
  );

  const completedReview = read(
    "app/inspections/components/CompletedInspectionReview.tsx"
  );
  const inspectionSessionPage = read("app/inspections/session/[id]/page.tsx");
  const workOrderPhotoField = read(
    "app/maintenance/components/WorkOrderPhotoField.tsx"
  );
  const workOrderResolutionModal = read(
    "app/maintenance/components/WorkOrderResolutionModal.tsx"
  );
  const dashboardWorkOrderModal = read(
    "app/dashboard/components/DashboardWorkOrderDetailModal.tsx"
  );
  const maintenancePage = read("app/maintenance/page.tsx");
  const mobileWorkOrderDetail = read(
    "app/mobile/work-orders/MobileWorkOrderDetail.tsx"
  );
  assert.ok(
    completedReview.includes("OperationalPhotoParentProvider") &&
      completedReview.includes("photoParent"),
    "completed inspection review keeps a tenant photo parent for signed URL refresh"
  );
  assert.ok(
    inspectionSessionPage.includes("photoParent={inspectionPhotoParent}") &&
      inspectionSessionPage.includes("OperationalPhotoParentProvider value={inspectionPhotoParent}"),
    "desktop completed inspections wrap historical photos with the session parent"
  );
  assert.ok(
    workOrderPhotoField.includes("refreshOperationalPhotoSrc") &&
      workOrderPhotoField.includes("useRefreshedPhotoUrl(photoUrl, resolvedParent)"),
    "work-order photo field refreshes expired signed URLs with the parent context"
  );
  assert.ok(
    workOrderResolutionModal.includes("workOrderId: number") &&
      workOrderResolutionModal.includes('type: "work_order"'),
    "work-order completion photo UI is bound to the parent work order"
  );
  assert.ok(
    dashboardWorkOrderModal.includes("OperationalPhotoParentProvider") &&
      dashboardWorkOrderModal.includes("workOrderId={currentWorkOrder.id}"),
    "dashboard work-order detail keeps photo parent context for historical photos"
  );
  assert.ok(
    maintenancePage.includes("OperationalPhotoParentProvider") &&
      maintenancePage.includes("workOrderId={selectedWorkOrder.id}"),
    "maintenance work-order detail keeps photo parent context for historical photos"
  );
  assert.ok(
    mobileWorkOrderDetail.includes("OperationalPhotoParentProvider") &&
      mobileWorkOrderDetail.includes("workOrderId={workOrder.id}"),
    "mobile work-order detail keeps photo parent context for historical photos"
  );

  const reportsInspectionModal = read(
    "app/reports/components/ReportsInspectionSessionDetailModal.tsx"
  );
  const reportsInspectionResults = read(
    "app/reports/components/ReportsInspectionResults.tsx"
  );
  const reportsPmModal = read(
    "app/reports/components/ReportsPmOccurrenceDetailModal.tsx"
  );
  const reportsPmFailed = read(
    "app/reports/components/ReportsPmFailedItemsResults.tsx"
  );
  assert.ok(
    reportsInspectionModal.includes("tenantFetch") &&
      !reportsInspectionModal.includes("await fetch("),
    "Reports inspection session detail uses tenantFetch"
  );
  assert.ok(
    reportsInspectionResults.includes("tenantFetch") &&
      !reportsInspectionResults.includes("await fetch("),
    "Reports inspection results uses tenantFetch"
  );
  assert.ok(
    reportsPmModal.includes("tenantFetch") &&
      !reportsPmModal.includes("await fetch("),
    "Reports PM occurrence detail uses tenantFetch"
  );
  assert.ok(
    reportsPmFailed.includes("tenantFetch") &&
      !reportsPmFailed.includes("await fetch("),
    "Reports PM failed items uses tenantFetch"
  );
}

async function main() {
  runParseTests();
  runCanonicalizeTests();
  runWriteRejectionTests();
  runAccessTests();
  runParentTypeTests();
  await runLegacyRefreshAndFallbackTests();
  runStaticWiringTests();
  console.log("verify-operational-photo-access: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
