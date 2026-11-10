import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OPERATIONAL_PHOTO_BUCKETS,
  OPERATIONAL_PHOTO_SIGNED_TTL_SECONDS,
  type OperationalPhotoBucket,
  type OperationalPhotoParent,
  type OperationalPhotoTenantScope,
  type ParsedOperationalPhoto,
} from "@/app/lib/storage/operational-photo-types";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

const TENANT_PREFIX = /^org-(\d+)\/property-(\d+)\//;
const OBJECT_PATH =
  /\/storage\/v1\/object\/(public|sign|authenticated)\/([^/]+)\/(.+)$/;

export function isOperationalPhotoBucket(
  value: string
): value is OperationalPhotoBucket {
  return (OPERATIONAL_PHOTO_BUCKETS as readonly string[]).includes(value);
}

function isAllowedStorageHost(hostname: string): boolean {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured) {
    try {
      if (new URL(configured).hostname === hostname) return true;
    } catch {
      // Ignore invalid env and fall through to the public suffix check.
    }
  }
  return hostname.endsWith(".supabase.co") || hostname === "localhost";
}

function stripQuery(path: string): string {
  return path.split("?")[0].split("#")[0];
}

function decodePath(path: string): string {
  const cleaned = stripQuery(path).replace(/^\/+/, "");
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

function tenantFromPath(path: string): {
  organizationId: number | null;
  propertyId: number | null;
} {
  const match = path.match(TENANT_PREFIX);
  if (!match) {
    return { organizationId: null, propertyId: null };
  }
  return {
    organizationId: Number(match[1]),
    propertyId: Number(match[2]),
  };
}

function fromBucketAndPath(
  bucket: string,
  rawPath: string,
  kind: ParsedOperationalPhoto["kind"]
): ParsedOperationalPhoto | null {
  if (!isOperationalPhotoBucket(bucket)) return null;
  const path = decodePath(rawPath);
  if (!path) return null;
  return {
    bucket,
    path,
    kind,
    ...tenantFromPath(path),
  };
}

export function parseOperationalPhotoRef(
  value: string | null | undefined,
  options?: { defaultBucket?: OperationalPhotoBucket }
): ParsedOperationalPhoto | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    const separator = trimmed.indexOf("|");
    if (separator > 0) {
      return fromBucketAndPath(
        trimmed.slice(0, separator),
        trimmed.slice(separator + 1),
        "storage-path"
      );
    }
    if (!options?.defaultBucket) return null;
    return fromBucketAndPath(options.defaultBucket, trimmed, "storage-path");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isAllowedStorageHost(parsedUrl.hostname)) return null;

  const match = parsedUrl.pathname.match(OBJECT_PATH);
  if (!match) return null;

  const kind = match[1] === "sign" ? "signed-url" : "public-url";
  return fromBucketAndPath(match[2], match[3], kind);
}

export function formatCanonicalOperationalPhotoRef(
  parsed: ParsedOperationalPhoto,
  defaultBucket?: OperationalPhotoBucket
): string {
  if (defaultBucket && parsed.bucket === defaultBucket) {
    return parsed.path;
  }
  return `${parsed.bucket}|${parsed.path}`;
}

export function canonicalizeOperationalPhotoRef(
  value: string | null | undefined,
  options?: { defaultBucket?: OperationalPhotoBucket }
): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const parsed = parseOperationalPhotoRef(trimmed, options);
  if (!parsed) return null;
  return formatCanonicalOperationalPhotoRef(parsed, options?.defaultBucket);
}

export function collectCanonicalPhotoPaths(
  values: Array<string | null | undefined>,
  defaultBucket: OperationalPhotoBucket
): Set<string> {
  const paths = new Set<string>();
  for (const value of values) {
    const parsed = parseOperationalPhotoRef(value, { defaultBucket });
    if (parsed) paths.add(`${parsed.bucket}|${parsed.path}`);
  }
  return paths;
}

export function photoRefKey(parsed: ParsedOperationalPhoto): string {
  return `${parsed.bucket}|${parsed.path}`;
}

export function isLegacyUnprefixedOperationalPhoto(
  parsed: ParsedOperationalPhoto
): boolean {
  return parsed.organizationId == null || parsed.propertyId == null;
}

export function collectKnownLegacyPhotoPaths(
  values: Array<string | null | undefined>,
  defaultBucket: OperationalPhotoBucket
): Set<string> {
  const paths = new Set<string>();
  for (const value of values) {
    const parsed = parseOperationalPhotoRef(value, { defaultBucket });
    if (!parsed || !isLegacyUnprefixedOperationalPhoto(parsed)) continue;
    paths.add(photoRefKey(parsed));
  }
  return paths;
}

export function canAccessOperationalPhoto(
  parsed: ParsedOperationalPhoto,
  scope: OperationalPhotoTenantScope,
  options: { knownLegacyPaths?: Iterable<string> }
): boolean {
  if (!isLegacyUnprefixedOperationalPhoto(parsed)) {
    return (
      parsed.organizationId === scope.organizationId &&
      parsed.propertyId === scope.propertyId
    );
  }
  // Unprefixed paths have no tenant in the object name. Authorize only when
  // the photo is already stored on a parent loaded for this org/property.
  if (!options.knownLegacyPaths) return false;
  const allowed = options.knownLegacyPaths instanceof Set
    ? options.knownLegacyPaths
    : new Set(options.knownLegacyPaths);
  return allowed.has(photoRefKey(parsed));
}

export function requireCanonicalOperationalPhotoForWrite(
  value: string | null | undefined,
  scope: OperationalPhotoTenantScope,
  options: {
    defaultBucket: OperationalPhotoBucket;
    existingRefs?: Array<string | null | undefined>;
    fieldName?: string;
  }
): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const field = options.fieldName || "photo";
  const parsed = parseOperationalPhotoRef(trimmed, {
    defaultBucket: options.defaultBucket,
  });
  if (!parsed) {
    throw new TenantRequestError(
      400,
      `Invalid ${field} reference.`
    );
  }

  if (parsed.organizationId != null && parsed.propertyId != null) {
    if (
      parsed.organizationId !== scope.organizationId ||
      parsed.propertyId !== scope.propertyId
    ) {
      throw new TenantRequestError(
        400,
        `Invalid ${field} reference.`
      );
    }
    return formatCanonicalOperationalPhotoRef(parsed, options.defaultBucket);
  }

  const known = collectCanonicalPhotoPaths(
    options.existingRefs || [],
    options.defaultBucket
  );
  if (!known.has(photoRefKey(parsed))) {
    throw new TenantRequestError(
      400,
      `Invalid ${field} reference.`
    );
  }
  return formatCanonicalOperationalPhotoRef(parsed, options.defaultBucket);
}

export async function signOperationalPhoto(
  supabase: SupabaseClient,
  parsed: ParsedOperationalPhoto,
  ttlSeconds = OPERATIONAL_PHOTO_SIGNED_TTL_SECONDS
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to sign operational photo");
  }
  return data.signedUrl;
}

export async function resolveOperationalPhotoDisplayUrl(
  supabase: SupabaseClient,
  stored: string | null | undefined,
  scope: OperationalPhotoTenantScope,
  options: {
    defaultBucket: OperationalPhotoBucket;
    knownLegacyPaths?: Iterable<string>;
    ttlSeconds?: number;
  }
): Promise<string | null> {
  if (stored == null) return null;
  const trimmed = String(stored).trim();
  if (!trimmed) return null;

  const parsed = parseOperationalPhotoRef(trimmed, {
    defaultBucket: options.defaultBucket,
  });
  if (!parsed) return null;
  if (
    !canAccessOperationalPhoto(parsed, scope, {
      knownLegacyPaths: options.knownLegacyPaths,
    })
  ) {
    return null;
  }

  try {
    return await signOperationalPhoto(supabase, parsed, options.ttlSeconds);
  } catch {
    return null;
  }
}

export async function resolveOperationalPhotoDisplayUrls(
  supabase: SupabaseClient,
  storedValues: Array<string | null | undefined>,
  scope: OperationalPhotoTenantScope,
  options: {
    defaultBucket: OperationalPhotoBucket;
    knownLegacyPaths?: Iterable<string>;
    ttlSeconds?: number;
  }
): Promise<Array<string | null>> {
  const unique = new Map<string, Promise<string | null>>();
  return Promise.all(
    storedValues.map((value) => {
      const key = value == null ? "" : String(value);
      if (!key) return Promise.resolve(null);
      const existing = unique.get(key);
      if (existing) return existing;
      const next = resolveOperationalPhotoDisplayUrl(
        supabase,
        value,
        scope,
        options
      );
      unique.set(key, next);
      return next;
    })
  );
}

async function parentPhotoRefs(
  supabase: SupabaseClient,
  parent: OperationalPhotoParent,
  scope: OperationalPhotoTenantScope
): Promise<Array<{ value: string; defaultBucket: OperationalPhotoBucket }>> {
  if (parent.type === "inspection_session") {
    const { data, error } = await supabase
      .from("inspection_item_responses")
      .select("photo_url")
      .eq("inspection_id", parent.id)
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId)
      .not("photo_url", "is", null);
    if (error) throw new Error(error.message);
    return (data || [])
      .map((row) => String(row.photo_url || "").trim())
      .filter(Boolean)
      .map((value) => ({
        value,
        defaultBucket: "inspection-photos" as const,
      }));
  }

  if (parent.type === "work_order") {
    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .select("photo_url, resolution_photo_url")
      .eq("id", parent.id)
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId)
      .maybeSingle();
    if (workOrderError) throw new Error(workOrderError.message);
    if (!workOrder) return [];

    const { data: extras, error: extrasError } = await supabase
      .from("work_order_photos")
      .select("photo_url, storage_path")
      .eq("work_order_id", parent.id)
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
    if (extrasError) throw new Error(extrasError.message);

    const values: Array<{
      value: string;
      defaultBucket: OperationalPhotoBucket;
    }> = [];
    if (workOrder.photo_url) {
      values.push({
        value: String(workOrder.photo_url),
        defaultBucket: "work-order-photos",
      });
    }
    if (workOrder.resolution_photo_url) {
      values.push({
        value: String(workOrder.resolution_photo_url),
        defaultBucket: "work-order-photos",
      });
    }
    for (const row of extras || []) {
      if (row.storage_path) {
        values.push({
          value: String(row.storage_path),
          defaultBucket: "work-order-photos",
        });
      }
      if (row.photo_url) {
        values.push({
          value: String(row.photo_url),
          defaultBucket: "work-order-photos",
        });
      }
    }
    return values;
  }

  const { data, error } = await supabase
    .from("pm_occurrences")
    .select("responses")
    .eq("id", parent.id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];

  const responses = (data.responses || {}) as {
    targetPhotoUrl?: string | null;
    steps?: Array<{ photoUrl?: string | null }>;
  };
  const values: Array<{
    value: string;
    defaultBucket: OperationalPhotoBucket;
  }> = [];
  if (responses.targetPhotoUrl) {
    values.push({
      value: String(responses.targetPhotoUrl),
      defaultBucket: "inspection-photos",
    });
  }
  for (const step of responses.steps || []) {
    if (step.photoUrl) {
      values.push({
        value: String(step.photoUrl),
        defaultBucket: "inspection-photos",
      });
    }
  }
  return values;
}

export async function parentContainsOperationalPhoto(
  supabase: SupabaseClient,
  parent: OperationalPhotoParent,
  parsed: ParsedOperationalPhoto,
  scope: OperationalPhotoTenantScope
): Promise<boolean> {
  const refs = await parentPhotoRefs(supabase, parent, scope);
  return refs.some((ref) => {
    const candidate = parseOperationalPhotoRef(ref.value, {
      defaultBucket: ref.defaultBucket,
    });
    return (
      candidate?.bucket === parsed.bucket && candidate.path === parsed.path
    );
  });
}

export function isOperationalPhotoParent(
  value: unknown
): value is OperationalPhotoParent {
  if (!value || typeof value !== "object") return false;
  const record = value as { type?: unknown; id?: unknown };
  const id = Number(record.id);
  if (!Number.isInteger(id) || id <= 0) return false;
  return (
    record.type === "inspection_session" ||
    record.type === "work_order" ||
    record.type === "pm_occurrence"
  );
}

export async function knownLegacyPathsForParent(
  supabase: SupabaseClient,
  parent: OperationalPhotoParent,
  scope: OperationalPhotoTenantScope
): Promise<Set<string>> {
  const refs = await parentPhotoRefs(supabase, parent, scope);
  const known = new Set<string>();
  for (const ref of refs) {
    const candidate = parseOperationalPhotoRef(ref.value, {
      defaultBucket: ref.defaultBucket,
    });
    if (candidate) known.add(photoRefKey(candidate));
  }
  return known;
}

export async function refreshOperationalPhotoDisplayUrl(
  supabase: SupabaseClient,
  stored: string,
  scope: OperationalPhotoTenantScope,
  parent: OperationalPhotoParent | null,
  options?: { defaultBucket?: OperationalPhotoBucket }
): Promise<string | null> {
  const parsed = parseOperationalPhotoRef(stored, options);
  if (!parsed) return null;

  if (!isLegacyUnprefixedOperationalPhoto(parsed)) {
    if (!canAccessOperationalPhoto(parsed, scope, {})) {
      return null;
    }
    return resolveOperationalPhotoDisplayUrl(supabase, stored, scope, {
      defaultBucket: parsed.bucket,
    });
  }

  if (!parent) return null;

  try {
    const belongsToParent = await parentContainsOperationalPhoto(
      supabase,
      parent,
      parsed,
      scope
    );
    if (!belongsToParent) return null;
  } catch {
    return null;
  }

  return resolveOperationalPhotoDisplayUrl(supabase, stored, scope, {
    defaultBucket: parsed.bucket,
    knownLegacyPaths: new Set([photoRefKey(parsed)]),
  });
}
