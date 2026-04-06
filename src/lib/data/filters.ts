export type SearchParamValue = string | string[] | undefined;

export function getSearchParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value?.trim() ?? '';
}

export function normalizeOptionalFilter(value: string): string | null {
  return value ? value : null;
}

export function normalizeBooleanFilter(value: string): boolean {
  return value === '1';
}

export function normalizeDateFilter(value: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return value;
}

export function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function countActiveFilters(values: Array<string | null | boolean>): number {
  return values.filter((value) => {
    if (typeof value === 'boolean') return value;
    return Boolean(value);
  }).length;
}

export function includesQuery(haystack: Array<string | null | undefined>, query: string | null): boolean {
  if (!query) return true;

  const normalizedQuery = query.toLowerCase();
  return haystack.some((value) => value?.toLowerCase().includes(normalizedQuery));
}
