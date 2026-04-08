import Link from 'next/link';
import { addNoteAction } from '@/app/app/actions';
import { PageHeader, MetricCard } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, getNoteContactName, getNotePreview, getNotesPageData, matchesNoteQuery } from '@/lib/data/notes';
import { formatReviewFlags } from '@/lib/data/record-quality';

type NotesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getParam(resolvedSearchParams.created);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const organizationFilter = getParam(resolvedSearchParams.organization).trim();
  const contactFilter = getParam(resolvedSearchParams.contact).trim();

  const supabase = await createClient();
  const data = await getNotesPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (organizationFilter && (row.organization?.id ?? '') !== organizationFilter) return false;
    if (contactFilter && (row.contact?.id ?? '') !== contactFilter) return false;
    if (query && !matchesNoteQuery(row, query)) return false;
    return true;
  });

  const activeFilterCount = [query, organizationFilter, contactFilter].filter(Boolean).length;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Notes"
        title="Meeting notes, memos, and context"
        description={
          <>
            Capture relationship context, meeting takeaways, and strategic notes linked to
            organizations, contacts, or fundraising accounts.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Notes'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/notes' : '/app/notes?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewNotes})`,
            variant: 'secondary'
          }
        ]}
      />

      {created === 'note' && <div className="banner bannerSuccess">Note added successfully.</div>}
      {error && <div className="banner bannerError">{error}</div>}

      <div className="grid grid-3">
        <MetricCard label="Total notes" value={data.verifiedNotes} note={`of ${data.totalNotes} total`} tone="accent" />
        <MetricCard label="Pinned" value={data.pinnedNotes} note="Important notes pinned for quick access" tone="success" />
        <MetricCard label="Review queue" value={data.reviewNotes} note="Needs triage" />
      </div>

      {!reviewMode && activeFilterCount === 0 ? (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Organization note trails</h2>
              <div className="subtle">Jump into the organizations carrying the most note context.</div>
            </div>
          </div>
          <div className="activityList">
            {data.organizationOptions.slice(0, 8).map((org) => (
              <div key={org.id} className="activityItem">
                <Link href={`/app/organizations/${org.id}`} className="tableTitle">{org.name}</Link>
                <div className="contextLinksRow" style={{ marginTop: 8 }}>
                  <Link href={`/app/notes?organization=${org.id}`} className="inlineLink">View notes</Link>
                  <span>·</span>
                  <Link href={`/app/interactions?organization=${org.id}`} className="inlineLink">Open interactions</Link>
                  <span>·</span>
                  <Link href={`/app/tasks?organization=${org.id}`} className="inlineLink">Open tasks</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">
                {reviewMode ? 'Review queue' : 'All notes'} ({filteredRows.length})
              </h2>
            </div>
          </div>

          <form method="get" action="/app/notes" className="filterBar">
            <input type="text" name="q" placeholder="Search note, org, or contact…" defaultValue={query} className="filterInput" />
            <select name="organization" defaultValue={organizationFilter} className="filterSelect">
              <option value="">All organizations</option>
              {data.organizationOptions.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select name="contact" defaultValue={contactFilter} className="filterSelect">
              <option value="">All contacts</option>
              {data.contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name ?? `${contact.first_name} ${contact.last_name ?? ''}`.trim()}
                </option>
              ))}
            </select>
            {reviewMode && <input type="hidden" name="view" value="review" />}
            <button type="submit" className="secondaryButton">Search</button>
            <Link href={reviewMode ? '/app/notes?view=review' : '/app/notes'} className="secondaryButton">Reset</Link>
          </form>

          <div className="activityList">
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <div key={row.id} className="activityItem">
                  <div className="splitRow">
                    <div>
                      <strong>{row.title ?? 'Untitled note'}</strong>
                      {row.pinned && (
                        <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--accent)', color: '#fff' }}>pinned</span>
                      )}
                      {row.note_type && (
                        <span className="badge" style={{ marginLeft: '0.25rem' }}>{row.note_type}</span>
                      )}
                    </div>
                    <span className="badge">{formatDateTime(row.created_at)}</span>
                  </div>
                  <div className="tableSubtle">{getNotePreview(row.body)}</div>
                  <div className="tableSubtle contextLinksRow">
                    {row.organization ? (
                      <Link href={`/app/organizations/${row.organization.id}`} className="inlineLink">
                        {row.organization.name}
                      </Link>
                    ) : null}
                    {row.contact ? (
                      <>
                        {row.organization ? <span>·</span> : null}
                        <Link href={`/app/contacts/${row.contact.id}`} className="inlineLink">
                          {getNoteContactName(row.contact)}
                        </Link>
                      </>
                    ) : null}
                    {row.organization ? (
                      <>
                        <span>·</span>
                        <Link href={`/app/interactions?organization=${row.organization.id}`} className="inlineLink">Interactions</Link>
                      </>
                    ) : null}
                    {!row.organization && !row.contact ? <span>No linked context</span> : null}
                    {row.quality === 'review' && (
                      <span style={{ color: 'var(--review)' }}>
                        ({formatReviewFlags(row.review_flags).join(', ')})
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyState">
                <div className="emptyStateTitle">{query ? 'No matches' : 'No notes yet'}</div>
                <div className="emptyStateBody">
                  {query || organizationFilter ? 'Try a different search term.' : 'Capture your first note using the form.'}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Add note</h2>
              <div className="subtle">Capture meeting notes, memos, or context.</div>
            </div>
          </div>
          <form action={addNoteAction} className="formStack">
            <div className="formGroup">
              <label htmlFor="title" className="formLabel">Title</label>
              <input type="text" id="title" name="title" className="formInput" />
            </div>
            <div className="formGroup">
              <label htmlFor="body" className="formLabel">Content *</label>
              <textarea id="body" name="body" required rows={6} className="formInput" />
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="note_type" className="formLabel">Type</label>
                <select id="note_type" name="note_type" className="formInput">
                  <option value="general">General</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="strategy">Strategy</option>
                  <option value="diligence">Diligence</option>
                  <option value="memo">Memo</option>
                </select>
              </div>
              <div className="formGroup">
                <label htmlFor="pinned" className="formLabel">Pin note?</label>
                <select id="pinned" name="pinned" className="formInput">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="organization_id" className="formLabel">Organization</label>
                <select id="organization_id" name="organization_id" className="formInput">
                  <option value="">None</option>
                  {data.organizationOptions.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="formGroup">
                <label htmlFor="contact_id" className="formLabel">Contact</label>
                <select id="contact_id" name="contact_id" className="formInput">
                  <option value="">None</option>
                  {data.contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name ?? `${c.first_name} ${c.last_name ?? ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="primaryButton">Save note</button>
          </form>
        </section>
      </div>
    </div>
  );
}
