export function toggleSelectedOutcome<T extends string>(
  current: T | null | undefined,
  selected: T
): T | undefined {
  return current === selected ? undefined : selected;
}
