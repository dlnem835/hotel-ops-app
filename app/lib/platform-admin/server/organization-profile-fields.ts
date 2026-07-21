/**
 * Shared normalization + validation for the organization OPERATIONAL profile.
 *
 * These are the fields a customer Organization Admin is allowed to edit:
 *   - name (display name)
 *   - contact_email, contact_phone, business_address, contact_name
 *
 * Legal identity (legal_name, slug, id, status) is intentionally NOT handled here
 * — those remain One Eyrie Platform Administration concerns and are applied by the
 * platform update path only.
 */

export type OrganizationProfilePatch = {
  name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  business_address?: string | null;
  contact_name?: string | null;
};

export type NormalizeProfileResult =
  | { ok: true; patch: OrganizationProfilePatch }
  | { ok: false; status: number; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build a DB patch from an incoming request body. Only keys explicitly present in
 * the body are considered, so callers can PATCH a subset of fields. When
 * `requireName` is true, a valid non-empty display name must be provided.
 */
export function normalizeOrganizationOperationalProfile(
  body: Record<string, unknown>,
  options: { requireName: boolean }
): NormalizeProfileResult {
  const patch: OrganizationProfilePatch = {};

  if (options.requireName || "name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) {
      return { ok: false, status: 400, message: "Organization name is required" };
    }
    if (name.length > 120) {
      return { ok: false, status: 400, message: "Organization name is too long" };
    }
    patch.name = name;
  }

  if ("contactEmail" in body) {
    const email = normalizeText(body.contactEmail);
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
      return { ok: false, status: 400, message: "Contact email is not valid" };
    }
    patch.contact_email = email;
  }

  if ("contactPhone" in body) {
    const phone = normalizeText(body.contactPhone);
    if (phone && phone.length > 40) {
      return { ok: false, status: 400, message: "Contact phone is too long" };
    }
    patch.contact_phone = phone;
  }

  if ("businessAddress" in body) {
    const address = normalizeText(body.businessAddress);
    if (address && address.length > 500) {
      return { ok: false, status: 400, message: "Business address is too long" };
    }
    patch.business_address = address;
  }

  if ("contactName" in body) {
    const contactName = normalizeText(body.contactName);
    if (contactName && contactName.length > 120) {
      return { ok: false, status: 400, message: "Contact name is too long" };
    }
    patch.contact_name = contactName;
  }

  return { ok: true, patch };
}
