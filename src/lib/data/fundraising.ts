import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assessRecordQuality,
  isActiveFundraisingStage,
  isActiveFundraisingStatus,
  type ReviewFlag
} from '@/lib/data/record-quality';

export interface FundraisingRow {
  id: string;
  stage: string;
  status: string;
  relationship_temperature: string | null;
  probability_pct: number | null;
  target_commitment: number | null;
  soft_circled_amount: number | null;
  committed_amount: number | null;
  wired_amount: number | null;
  memo: string | null;
  organization: {
    id: string;
    name: string;
    organization_type: string;
    headquarters: string | null;
    tags: string[] | null;
  } | null;
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
  is_active: boolean;
}

interface FundraisingQueryRow extends Omit<FundraisingRow, 'organization'> {
  organization:
    | Array<{
        id: string;
        name: string;
        organization_type: string;
        headquarters: string | null;
        tags: string[] | null;
      }>
    | null;
}

export interface FundraisingPageData {
  source: 'supabase' | 'empty';
  totalOrganizations: number;
  totalAccounts: number;
  verifiedAccounts: number;
  reviewAccounts: number;
  activeAccounts: number;
  stageCounts: Array<{ stage: string; count: number }>;
  totalTarget: number;
  totalCommitted: number;
  totalSoftCircled: number;
  rows: FundraisingRow[];
  reviewRows: FundraisingRow[];
}

function firstRelated<T>(value: T[] | null | undefined): T | null {
  return value?.[0] ?? null;
}

function normalizeRows(rows: FundraisingQueryRow[]): FundraisingRow[] {
  return rows.map((row) => ({
    ...row,
    organization: firstRelated(row.organization),
    ...(() => {
      const organization = firstRelated(row.organization);
      const quality = assessRecordQuality(
        [organization?.name, organization?.organization_type, organization?.headquarters, row.memo, row.stage, row.status],
        { requireIdentity: true }
      );
      const isActive = isActiveFundraisingStatus(row.status) && isActiveFundraisingStage(row.stage);
      const reviewFlags = [...quality.flags];

      if (!isActive) {
        reviewFlags.push('inactive_fundraising');
      }

      return {
        quality: quality.quality === 'review' || !isActive ? 'review' : 'verified',
        review_flags: reviewFlags,
        is_active: isActive
      };
    })()
  }));
}

export function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}

export function matchesFundraisingQuery(row: FundraisingRow, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const haystack = [
    row.organization?.name,
    row.organization?.organization_type,
    row.organization?.headquarters,
    row.organization?.tags?.join(' '),
    row.stage,
    row.status,
    row.relationship_temperature,
    row.memo
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export async function getFundraisingPageData(supabase: SupabaseClient): Promise<FundraisingPageData> {
  const [
    { data: accountsData, error: accountsError, count },
    { count: organizationCount, error: organizationsError }
  ] = await Promise.all([
    supabase
      .from('fundraising_accounts')
      .select(
        `
          id,
          stage,
          status,
          relationship_temperature,
          probability_pct,
          target_commitment,
          soft_circled_amount,
          committed_amount,
          wired_amount,
          memo,
          organization:organizations!fundraising_accounts_organization_id_fkey (
            id,
            name,
            organization_type,
            headquarters,
            tags
          )
        `,
        { count: 'exact' }
      )
      .order('target_commitment', { ascending: false, nullsFirst: false })
      .limit(250),
    supabase.from('organizations').select('id', { head: true, count: 'exact' })
  ]);

  if (accountsError || organizationsError) {
    return {
      source: 'empty',
      totalOrganizations: 0,
      totalAccounts: 0,
      verifiedAccounts: 0,
      reviewAccounts: 0,
      activeAccounts: 0,
      stageCounts: [],
      totalTarget: 0,
      totalCommitted: 0,
      totalSoftCircled: 0,
      rows: [],
      reviewRows: []
    };
  }

  const allRows = normalizeRows((accountsData ?? []) as unknown as FundraisingQueryRow[]);
  const rows = allRows.filter((row) => row.quality === 'verified');
  const reviewRows = allRows.filter((row) => row.quality === 'review');
  const stageMap = new Map<string, number>();
  let totalTarget = 0;
  let totalCommitted = 0;
  let totalSoftCircled = 0;

  for (const row of rows) {
    stageMap.set(row.stage, (stageMap.get(row.stage) ?? 0) + 1);
    totalTarget += row.target_commitment ?? 0;
    totalCommitted += row.committed_amount ?? 0;
    totalSoftCircled += row.soft_circled_amount ?? 0;
  }

  return {
    source: allRows.length ? 'supabase' : 'empty',
    totalOrganizations: organizationCount ?? 0,
    totalAccounts: count ?? allRows.length,
    verifiedAccounts: rows.length,
    reviewAccounts: reviewRows.length,
    activeAccounts: rows.filter((row) => row.is_active).length,
    stageCounts: Array.from(stageMap.entries())
      .map(([stage, stageCount]) => ({ stage, count: stageCount }))
      .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    totalTarget,
    totalCommitted,
    totalSoftCircled,
    rows,
    reviewRows
  };
}
