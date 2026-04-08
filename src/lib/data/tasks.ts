import type { SupabaseClient } from '@supabase/supabase-js';
import { curateRecords, type CuratedReason, curateInteractionLikeRecord } from '@/lib/data/curation';
import type { ReviewFlag } from '@/lib/data/record-quality';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
  completed_at: string | null;
  source_system: string | null;
  created_at: string | null;
  organization_id: string | null;
  contact_id: string | null;
  fundraising_account_id: string | null;
  organization: { id: string; name: string } | null;
  contact: { id: string; full_name: string | null; first_name: string; last_name: string | null } | null;
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
}

export interface TaskPageData {
  source: 'supabase' | 'empty';
  totalTasks: number;
  verifiedTasks: number;
  reviewTasks: number;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  rows: TaskRow[];
  reviewRows: TaskRow[];
  hiddenRows: Array<{
    row: TaskRow;
    reasons: CuratedReason[];
  }>;
  organizationOptions: Array<{ id: string; name: string }>;
  contactOptions: Array<{ id: string; full_name: string | null; first_name: string; last_name: string | null }>;
}

export function getTaskContactName(contact: TaskRow['contact']): string {
  if (!contact) return 'Unknown contact';
  return contact.full_name ?? (`${contact.first_name} ${contact.last_name ?? ''}`.trim() || 'Unknown contact');
}

function normalizeRelation<T>(val: T | T[] | null): T | null {
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(task: { status: string | null; due_at: string | null }): boolean {
  if (!task.due_at) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_at) < new Date();
}

export function matchesTaskQuery(row: TaskRow, query: string): boolean {
  const q = query.toLowerCase();
  return [
    row.title,
    row.description,
    row.status,
    row.priority,
    row.organization?.name,
    row.contact?.full_name,
    row.contact ? `${row.contact.first_name} ${row.contact.last_name ?? ''}`.trim() : null
  ]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q));
}

export async function getTasksPageData(supabase: SupabaseClient): Promise<TaskPageData> {
  const [taskResult, orgResult, contactResult] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        *,
        organization:organizations(id, name),
        contact:contacts(id, full_name, first_name, last_name)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('organizations')
      .select('id, name')
      .order('name'),
    supabase
      .from('contacts')
      .select('id, full_name, first_name, last_name')
      .eq('status', 'active')
      .order('full_name')
  ]);

  const data = taskResult.data ?? [];
  const organizationOptions = orgResult.data ?? [];
  const contactOptions = contactResult.data ?? [];

  const allRows: TaskRow[] = data.map((raw) => ({
    ...raw,
    organization: normalizeRelation(raw.organization),
    contact: normalizeRelation(raw.contact),
    quality: 'verified',
    review_flags: []
  }));

  const curated = curateRecords(allRows, (row) => {
    const evaluation = curateInteractionLikeRecord({
      markerValues: [row.title, row.description, row.status, row.priority, row.organization?.name, row.contact?.full_name],
      hasOccurredAt: Boolean(row.created_at || row.due_at),
      hasSummary: Boolean(row.title?.trim() || row.description?.trim()),
      hasLinkedSubjects: Boolean(row.organization || row.contact),
      hasFundraisingLink: Boolean(row.fundraising_account_id),
      hasSource: Boolean(row.source_system || row.status || row.priority)
    });

    const review_flags: ReviewFlag[] = [];
    if (evaluation.reasons.some((reason) => reason.code === 'synthetic_marker')) review_flags.push('contains_test_marker');
    if (evaluation.reasons.some((reason) => reason.code === 'missing_identity')) review_flags.push('missing_identity');

    return {
      row: {
        ...row,
        quality: (evaluation.hidden ? 'review' : 'verified') as 'review' | 'verified',
        review_flags
      },
      ...evaluation
    };
  });

  const rows = curated.visible.map((item) => item.row);
  const reviewRows = curated.hidden.map((item) => item.row);
  let openTasks = 0;
  let overdueTasks = 0;
  let completedTasks = 0;

  for (const row of rows) {
    if (row.status === 'completed') completedTasks++;
    else {
      openTasks++;
      if (isOverdue(row)) overdueTasks++;
    }
  }

  return {
    source: data.length ? 'supabase' : 'empty',
    totalTasks: data.length,
    verifiedTasks: rows.length,
    reviewTasks: reviewRows.length,
    openTasks,
    overdueTasks,
    completedTasks,
    rows,
    reviewRows,
    hiddenRows: curated.hidden.map((item) => ({ row: item.row, reasons: item.reasons })),
    organizationOptions,
    contactOptions
  };
}
