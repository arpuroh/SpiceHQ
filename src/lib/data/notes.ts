import type { SupabaseClient } from '@supabase/supabase-js';
import { curateRecords, type CuratedReason, curateInteractionLikeRecord } from '@/lib/data/curation';
import type { ReviewFlag } from '@/lib/data/record-quality';

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
  hiddenRows: Array<{
    row: NoteRow;
    reasons: CuratedReason[];
  }>;
  organizationOptions: Array<{ id: string; name: string }>;
  contactOptions: Array<{ id: string; full_name: string | null; first_name: string; last_name: string | null }>;
}

export function getNoteContactName(contact: NoteRow['contact']): string {
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

export function matchesNoteQuery(row: NoteRow, query: string): boolean {
  const q = query.toLowerCase();
  return [
    row.title,
    row.body,
    row.note_type,
    row.organization?.name,
    row.contact?.full_name,
    row.contact ? `${row.contact.first_name} ${row.contact.last_name ?? ''}`.trim() : null
  ]
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

  const allRows: NoteRow[] = data.map((raw) => {
    const organization = normalizeRelation(raw.organization);
    const contact = normalizeRelation(raw.contact);
    return {
      ...raw,
      organization,
      contact,
      quality: 'verified',
      review_flags: []
    };
  });

  const curated = curateRecords(allRows, (row) => {
    const evaluation = curateInteractionLikeRecord({
      markerValues: [row.title, row.body, row.note_type, row.organization?.name, row.contact?.full_name],
      hasOccurredAt: Boolean(row.created_at),
      hasSummary: Boolean(row.title?.trim() || row.body?.trim()),
      hasLinkedSubjects: Boolean(row.organization || row.contact),
      hasFundraisingLink: Boolean(row.fundraising_account_id),
      hasSource: true
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
  const pinnedNotes = rows.filter((row) => row.pinned).length;

  return {
    source: data.length ? 'supabase' : 'empty',
    totalNotes: data.length,
    verifiedNotes: rows.length,
    reviewNotes: reviewRows.length,
    pinnedNotes,
    rows,
    reviewRows,
    hiddenRows: curated.hidden.map((item) => ({ row: item.row, reasons: item.reasons })),
    organizationOptions,
    contactOptions
  };
}
