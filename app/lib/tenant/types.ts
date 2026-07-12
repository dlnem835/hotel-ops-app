export type TenantOrganizationSummary = {
  id: number;
  name: string;
  slug: string;
  role: string;
};

export type TenantPropertySummary = {
  id: number;
  name: string;
  brand: string | null;
  timezone: string;
  organizationId: number;
  role: string;
  isDefault: boolean;
};

export type TenantActiveProperty = {
  id: number;
  name: string;
  brand: string | null;
  timezone: string;
  organizationId: number;
  role: string;
};

export type TenantContextResponse = {
  organization: TenantOrganizationSummary;
  properties: TenantPropertySummary[];
  activeProperty: TenantActiveProperty;
};
