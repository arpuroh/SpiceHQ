import type { SupabaseClient } from '@supabase/supabase-js';
import {
  curateOrganizationLikeRecord,
  curateRecords,
  type CuratedReason
} from '@/lib/data/curation';

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
  visibleAccounts: number;
  hiddenAccounts: number;
  stageCounts: Array<{ stage: string; count: number }>;
  totalTarget: number;
  totalCommitted: number;
  totalSoftCircled: number;
  rows: FundraisingRow[];
  hiddenRows: Array<{
    row: FundraisingRow;
    reasons: CuratedReason[];
  }>;
}

function firstRelated<T>(value: T[] | null | undefined): T | null {
  return value?.[0] ?? null;
}

function normalizeRows(rows: FundraisingQueryRow[]): FundraisingRow[] {
  return rows.map((row) => ({
    ...row,
    organization: firstRelated(row.organization)
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
    row.memo,
    row.probability_pct != null ? String(row.probability_pct) : null
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
      visibleAccounts: 0,
      hiddenAccounts: 0,
      stageCounts: [],
      totalTarget: 0,
      totalCommitted: 0,
      totalSoftCircled: 0,
      rows: [],
      hiddenRows: []
    };
  }

  const allRows = normalizeRows((accountsData ?? []) as unknown as FundraisingQueryRow[]);
  const curated = curateRecords(allRows, (row) => {
    const evaluation = curateOrganizationLikeRecord({
      name: row.organization?.name,
      markerValues: [
        row.organization?.organization_type,
        row.organization?.headquarters,
        row.organization?.tags?.join(' '),
        row.stage,
        row.status,
        row.relationship_temperature,
        row.memo
      ],
      hasFinancialSignal: Boolean(
        row.target_commitment || row.soft_circled_amount || row.committed_amount || row.wired_amount
      ),
      hasEngagementSignal: Boolean(row.probability_pct !== null || row.relationship_temperature),
      hasMemo: Boolean(row.memo?.trim()),
      hasContext: Boolean(row.organization?.organization_type || row.organization?.headquarters || row.organization?.tags?.length)
    });

    return {
      row,
      ...evaluation
    };
  });
  const rows = curated.visible.map((item) => item.row);
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
    visibleAccounts: rows.length,
    hiddenAccounts: curated.hidden.length,
    stageCounts: Array.from(stageMap.entries())
      .map(([stage, stageCount]) => ({ stage, count: stageCount }))
      .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    totalTarget,
    totalCommitted,
    totalSoftCircled,
    rows,
    hiddenRows: curated.hidden.map((item) => ({
      row: item.row,
      reasons: item.reasons
    }))
  };
}
