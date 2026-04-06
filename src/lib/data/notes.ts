import type { SupabaseClient } from '@supabase/supabase-js';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

export interface NoteRow {
  id: string;
  title: string | null;
  body: string | null;
  note_type: string | null;
  pinned: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  organization_id: string | null;
  contact_id: string | null;
  fundraising_account_id: string | null;
  organization: { id: string; name: string } | null;
  contact: { id: string; full_name: string | null; first_name: string; last_name: string | null } | null;
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
}

export interface NotesPageData {
  source: 'supabase' | 'empty';
  totalNotes: number;
  verifiedNotes: number;
  reviewNotes: number;
  pinnedNotes: number;
  rows: NoteRow[];
  reviewRows: NoteRow[];
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

export function matchesNoteQuery(row: NoteRow, query: string): boolean {
  const q = query.toLowerCase();
  return [row.title, row.body, row.note_type]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q));
}

export function getNotePreview(body: string | null, maxLength = 120): string {
  if (!body) return 'No content';
  return body.length > maxLength ? body.slice(0, maxLength) + '…' : body;
}

export async function getNotesPageData(supabase: SupabaseClient): Promise<NotesPageData> {
  const [noteResult, orgResult, contactResult] = await Promise.all([
    supabase
      .from('notes')
      .select(`
        *,
        organization:organizations(id, name),
        contact:contacts(id, full_name, first_name, last_name)
      `)
      .order('pinned', { ascending: false })
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

  const data = noteResult.data ?? [];
  const organizationOptions = orgResult.data ?? [];
  const contactOptions = contactResult.data ?? [];

  const rows: NoteRow[] = [];
  const reviewRows: NoteRow[] = [];
  let pinnedNotes = 0;

  for (const raw of data) {
    const quality = assessRecordQuality([raw.title, raw.body], { requireIdentity: true });
    const row: NoteRow = {
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
      if (row.pinned) pinnedNotes++;
    }
  }

  return {
    source: data.length ? 'supabase' : 'empty',
    totalNotes: data.length,
    verifiedNotes: rows.length,
    reviewNotes: reviewRows.length,
    pinnedNotes,
    rows,
    reviewRows,
    organizationOptions,
    contactOptions
  };
}
