/**
 * Header used to carry the active property id from the client to tenant-scoped
 * API routes. Kept in a dependency-free module so it can be shared by both the
 * client fetch helper and server-only request resolver without pulling
 * service-role code into the client bundle.
 */
export const ONE_EYRIE_PROPERTY_HEADER = "x-one-eyrie-property-id";
