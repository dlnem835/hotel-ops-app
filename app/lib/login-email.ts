export function resolveStaffLoginEmail(input: string): string {
  const value = input.trim();
  if (!value) return value;
  if (value.includes("@")) {
    return value.toLowerCase();
  }
  return `${value}@oneeyrie.local`;
}
