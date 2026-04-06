import type { SupabaseClient } from '@supabase/supabase-js';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

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
  organizationOptions: Array<{ id: string; name: string }>;
  contactOptions: Array<{ id: string; full_name: string | null; first_name: string; last_name: string | null }>;
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
  return [row.title, row.description, row.status, row.priority]
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

  const rows: TaskRow[] = [];
  const reviewRows: TaskRow[] = [];
  let openTasks = 0;
  let overdueTasks = 0;
  let completedTasks = 0;

  for (const raw of data) {
    const quality = assessRecordQuality([raw.title, raw.description], { requireIdentity: true });
    const row: TaskRow = {
      ...raw,
      organization: normalizeRelation(raw.organization),
      contact: normalizeRelation(raw.contact),
      quality: quality.quality,
      review_flags: quality.flags
    };

    if (quality.quality === 'review') {
      reviewRows.push(row);
    } else {
      rows.push(row);
      if (row.status === 'completed') completedTasks++;
      else {
        openTasks++;
        if (isOverdue(row)) overdueTasks++;
      }
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
    organizationOptions,
    contactOptions
  };
}
