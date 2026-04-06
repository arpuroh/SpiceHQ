const HIGH_CONFIDENCE_MARKERS = [
  '[fake]',
  '[redacted]',
  'redacted',
  'fake',
  'synthetic',
  'placeholder',
  'dummy',
  'test contact',
  'test record',
  'lorem ipsum'
];

const LOW_CONFIDENCE_MARKERS = ['example.com', 'example.org', 'noreply', 'unknown', 'tbd', 'sample'];

export type ReviewFlag =
  | 'contains_fake_marker'
  | 'contains_redacted_marker'
  | 'contains_test_marker'
  | 'missing_identity'
  | 'inactive_fundraising';

export interface QualityAssessment {
  quality: 'verified' | 'review';
  flags: ReviewFlag[];
}

function collectText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLowerCase();
}

export function assessRecordQuality(values: Array<string | null | undefined>, options?: { requireIdentity?: boolean }): QualityAssessment {
  const text = collectText(values);
  const flags = new Set<ReviewFlag>();

  if (!text && options?.requireIdentity) {
    flags.add('missing_identity');
  }

  if (text.includes('[fake]') || text.includes(' fake ') || text.startsWith('fake ') || text.endsWith(' fake')) {
    flags.add('contains_fake_marker');
  }

  if (text.includes('[redacted]') || text.includes('redacted')) {
    flags.add('contains_redacted_marker');
  }

  if (
    HIGH_CONFIDENCE_MARKERS.some((marker) => text.includes(marker)) ||
    LOW_CONFIDENCE_MARKERS.some((marker) => text.includes(marker))
  ) {
    flags.add('contains_test_marker');
  }

  return {
    quality: flags.size ? 'review' : 'verified',
    flags: Array.from(flags)
  };
}

export function isActiveFundraisingStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return true;

  return !['inactive', 'closed', 'passed', 'declined', 'dead', 'lost'].includes(normalized);
}

export function isActiveFundraisingStage(stage: string | null | undefined) {
  const normalized = stage?.trim().toLowerCase();
  if (!normalized) return true;

  return !['closed lost', 'closed', 'archived', 'dead', 'passed'].includes(normalized);
}

export function formatReviewFlags(flags: ReviewFlag[]) {
  return flags.map((flag) => {
    switch (flag) {
      case 'contains_fake_marker':
        return 'fake marker';
      case 'contains_redacted_marker':
        return 'redacted marker';
      case 'contains_test_marker':
        return 'test/synthetic marker';
      case 'missing_identity':
        return 'missing identity';
      case 'inactive_fundraising':
        return 'inactive fundraising';
      default:
        return flag;
    }
  });
}
