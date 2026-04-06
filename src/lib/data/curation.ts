const syntheticMarkerPattern =
  /\[(fake|redacted)\]|\b(fake|redacted|dummy|placeholder|test(?:ing)?|sample|mock|lorem ipsum)\b/i;
const placeholderValuePattern = /^(unknown|n\/a|na|none|null|redacted|fake|test|tbd|missing)$/i;

export const CURATION_RULES = [
  'Hide rows containing explicit synthetic markers such as [FAKE], [REDACTED], dummy, placeholder, sample, or test labels.',
  'Hide rows with missing identity, including blank primary names or placeholder identity values like unknown, n/a, or missing.',
  'Hide low-signal records that lack enough usable context to act on, while retaining them in a review queue with reasons.',
  'Prioritize visible rows by usable identity, linked entities, contactability, and concrete fundraising or interaction signal.'
] as const;

export interface CuratedReason {
  code: 'synthetic_marker' | 'missing_identity' | 'low_signal';
  label: string;
  detail: string;
}

export interface CuratedRecord<T> {
  row: T;
  score: number;
  hidden: boolean;
  reasons: CuratedReason[];
}

function cleanValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function hasContent(value: string | null | undefined): boolean {
  return cleanValue(value).length > 0;
}

function hasSyntheticMarker(values: Array<string | null | undefined>): boolean {
  return values.some((value) => syntheticMarkerPattern.test(cleanValue(value)));
}

function isPlaceholderValue(value: string | null | undefined): boolean {
  const normalized = cleanValue(value);
  return normalized.length > 0 && placeholderValuePattern.test(normalized);
}

function buildReasons(options: {
  hasSyntheticMarker: boolean;
  missingIdentity: boolean;
  lowSignal: boolean;
  missingIdentityDetail: string;
  lowSignalDetail: string;
}): CuratedReason[] {
  const reasons: CuratedReason[] = [];

  if (options.hasSyntheticMarker) {
    reasons.push({
      code: 'synthetic_marker',
      label: 'Synthetic marker',
      detail: 'Contains obvious fake, redacted, placeholder, or test text.'
    });
  }

  if (options.missingIdentity) {
    reasons.push({
      code: 'missing_identity',
      label: 'Missing identity',
      detail: options.missingIdentityDetail
    });
  }

  if (options.lowSignal) {
    reasons.push({
      code: 'low_signal',
      label: 'Low signal',
      detail: options.lowSignalDetail
    });
  }

  return reasons;
}

export function curateRecords<T>(
  rows: T[],
  evaluate: (row: T) => CuratedRecord<T>
): { visible: CuratedRecord<T>[]; hidden: CuratedRecord<T>[] } {
  const curated = rows.map(evaluate);
  const sortByScore = (a: CuratedRecord<T>, b: CuratedRecord<T>) => b.score - a.score;

  return {
    visible: curated.filter((item) => !item.hidden).sort(sortByScore),
    hidden: curated.filter((item) => item.hidden).sort(sortByScore)
  };
}

export function curateContactLikeRecord(options: {
  identityValues: Array<string | null | undefined>;
  markerValues: Array<string | null | undefined>;
  hasDirectContactMethod: boolean;
  hasProfessionalContext: boolean;
  hasOrganizationLink: boolean;
  status: string | null | undefined;
  hasNotes: boolean;
}): { hidden: boolean; score: number; reasons: CuratedReason[] } {
  const hasSynthetic = hasSyntheticMarker(options.markerValues);
  const missingIdentity = options.identityValues.every((value) => !hasContent(value) || isPlaceholderValue(value));
  const lowSignal =
    !options.hasDirectContactMethod &&
    !options.hasProfessionalContext &&
    !options.hasOrganizationLink &&
    !options.hasNotes;

  let score = 0;

  if (options.hasDirectContactMethod) score += 4;
  if (options.hasProfessionalContext) score += 2;
  if (options.hasOrganizationLink) score += 2;
  if (options.hasNotes) score += 1;

  const normalizedStatus = cleanValue(options.status).toLowerCase();
  if (['active', 'warm', 'prospect'].includes(normalizedStatus)) score += 1;
  if (['inactive', 'archived'].includes(normalizedStatus)) score -= 1;
  if (missingIdentity) score -= 5;
  if (lowSignal) score -= 4;
  if (hasSynthetic) score -= 8;

  return {
    hidden: hasSynthetic || missingIdentity || lowSignal,
    score,
    reasons: buildReasons({
      hasSyntheticMarker: hasSynthetic,
      missingIdentity,
      lowSignal,
      missingIdentityDetail: 'Primary identity fields are blank or use placeholder values.',
      lowSignalDetail: 'No reliable contact method, organization link, title, or notes to work from.'
    })
  };
}

export function curateOrganizationLikeRecord(options: {
  name: string | null | undefined;
  markerValues: Array<string | null | undefined>;
  hasFinancialSignal: boolean;
  hasEngagementSignal: boolean;
  hasMemo: boolean;
  hasContext: boolean;
}): { hidden: boolean; score: number; reasons: CuratedReason[] } {
  const missingIdentity = !hasContent(options.name) || isPlaceholderValue(options.name);
  const hasSynthetic = hasSyntheticMarker([options.name, ...options.markerValues]);
  const lowSignal =
    !options.hasFinancialSignal &&
    !options.hasEngagementSignal &&
    !options.hasMemo &&
    !options.hasContext;

  let score = 0;

  if (options.hasFinancialSignal) score += 4;
  if (options.hasEngagementSignal) score += 3;
  if (options.hasMemo) score += 1;
  if (options.hasContext) score += 1;
  if (missingIdentity) score -= 5;
  if (lowSignal) score -= 4;
  if (hasSynthetic) score -= 8;

  return {
    hidden: hasSynthetic || missingIdentity || lowSignal,
    score,
    reasons: buildReasons({
      hasSyntheticMarker: hasSynthetic,
      missingIdentity,
      lowSignal,
      missingIdentityDetail: 'Organization identity is blank or uses placeholder values.',
      lowSignalDetail: 'Account has no financial, relationship, memo, or organization context to prioritize.'
    })
  };
}

export function curateInteractionLikeRecord(options: {
  markerValues: Array<string | null | undefined>;
  hasOccurredAt: boolean;
  hasSummary: boolean;
  hasLinkedSubjects: boolean;
  hasFundraisingLink: boolean;
  hasSource: boolean;
}): { hidden: boolean; score: number; reasons: CuratedReason[] } {
  const hasSynthetic = hasSyntheticMarker(options.markerValues);
  const missingIdentity = !options.hasSummary && !options.hasLinkedSubjects;
  const lowSignal = !options.hasOccurredAt || (!options.hasLinkedSubjects && !options.hasSummary);

  let score = 0;

  if (options.hasOccurredAt) score += 3;
  if (options.hasSummary) score += 2;
  if (options.hasLinkedSubjects) score += 3;
  if (options.hasFundraisingLink) score += 1;
  if (options.hasSource) score += 1;
  if (missingIdentity) score -= 5;
  if (lowSignal) score -= 4;
  if (hasSynthetic) score -= 8;

  return {
    hidden: hasSynthetic || missingIdentity || lowSignal,
    score,
    reasons: buildReasons({
      hasSyntheticMarker: hasSynthetic,
      missingIdentity,
      lowSignal,
      missingIdentityDetail: 'Interaction has neither a usable summary nor linked contacts or organizations.',
      lowSignalDetail: 'Interaction is missing timing or relationship context, so it is suppressed from default views.'
    })
  };
}
