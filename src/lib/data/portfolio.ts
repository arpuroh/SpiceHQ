import type { SupabaseClient } from '@supabase/supabase-js';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

export interface PortfolioFounder {
  id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  role: string | null;
  is_primary: boolean | null;
}

export interface PortfolioCompanyRow {
  id: string;
  company_name: string;
  sector: string | null;
  stage: string | null;
  status: string | null;
  investment_date: string | null;
  investment_amount: number | null;
  ownership_percentage: number | null;
  valuation_at_entry: number | null;
  current_valuation: number | null;
  board_seat: boolean | null;
  lead_partner: string | null;
  website: string | null;
  headquarters: string | null;
  description: string | null;
  founded_year: number | null;
  employee_count: number | null;
  last_update_at: string | null;
  notes: string | null;
  created_at: string | null;
  organization_id: string | null;
  fund_id: string | null;
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
}

export interface PortfolioCompanyDetail extends PortfolioCompanyRow {
  founders: PortfolioFounder[];
  organization: { id: string; name: string } | null;
}

export interface PortfolioPageData {
  source: 'supabase' | 'empty';
  totalCompanies: number;
  verifiedCompanies: number;
  reviewCompanies: number;
  activeCompanies: number;
  totalInvested: number;
  totalCurrentValue: number;
  withBoardSeat: number;
  rows: PortfolioCompanyRow[];
  reviewRows: PortfolioCompanyRow[];
}

function assessPortfolioQuality(row: { company_name: string; sector: string | null; description: string | null; notes: string | null }) {
  return assessRecordQuality(
    [row.company_name, row.sector, row.description, row.notes],
    { requireIdentity: true }
  );
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function matchesPortfolioQuery(row: PortfolioCompanyRow, query: string): boolean {
  const q = query.toLowerCase();
  return [row.company_name, row.sector, row.stage, row.headquarters, row.lead_partner, row.notes]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q));
}

export async function getPortfolioPageData(supabase: SupabaseClient): Promise<PortfolioPageData> {
  const { data, error } = await supabase
    .from('portfolio_companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return {
      source: 'empty',
      totalCompanies: 0,
      verifiedCompanies: 0,
      reviewCompanies: 0,
      activeCompanies: 0,
      totalInvested: 0,
      totalCurrentValue: 0,
      withBoardSeat: 0,
      rows: [],
      reviewRows: []
    };
  }

  const rows: PortfolioCompanyRow[] = [];
  const reviewRows: PortfolioCompanyRow[] = [];
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let activeCompanies = 0;
  let withBoardSeat = 0;

  for (const row of data) {
    const quality = assessPortfolioQuality(row);
    const enriched: PortfolioCompanyRow = { ...row, quality: quality.quality, review_flags: quality.flags };

    if (quality.quality === 'review') {
      reviewRows.push(enriched);
    } else {
      rows.push(enriched);
      if (row.status === 'active') {
        activeCompanies++;
        totalInvested += row.investment_amount ?? 0;
        totalCurrentValue += row.current_valuation ?? 0;
      }
      if (row.board_seat) withBoardSeat++;
    }
  }

  return {
    source: 'supabase',
    totalCompanies: data.length,
    verifiedCompanies: rows.length,
    reviewCompanies: reviewRows.length,
    activeCompanies,
    totalInvested,
    totalCurrentValue,
    withBoardSeat,
    rows,
    reviewRows
  };
}

export async function getPortfolioDetailData(supabase: SupabaseClient, id: string): Promise<PortfolioCompanyDetail | null> {
  const { data, error } = await supabase
    .from('portfolio_companies')
    .select(`
      *,
      organization:organizations(id, name),
      portfolio_company_founders(
        role,
        is_primary,
        contact:contacts(id, full_name, first_name, last_name, job_title, email)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const quality = assessPortfolioQuality(data);
  const org = Array.isArray(data.organization) ? data.organization[0] ?? null : data.organization;
  const founders: PortfolioFounder[] = (data.portfolio_company_founders ?? []).map((f: Record<string, unknown>) => {
    const contact = Array.isArray(f.contact) ? f.contact[0] : f.contact;
    return {
      id: contact?.id ?? '',
      full_name: contact?.full_name ?? null,
      first_name: contact?.first_name ?? '',
      last_name: contact?.last_name ?? null,
      job_title: contact?.job_title ?? null,
      email: contact?.email ?? null,
      role: f.role as string | null,
      is_primary: f.is_primary as boolean | null,
    };
  });

  return {
    ...data,
    quality: quality.quality,
    review_flags: quality.flags,
    organization: org,
    founders
  };
}
