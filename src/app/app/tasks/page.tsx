import Link from 'next/link';
import { addTaskAction, updateTaskAction } from '@/app/app/actions';
import { PageHeader, MetricCard } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, getTasksPageData, isOverdue, matchesTaskQuery } from '@/lib/data/tasks';
import { formatReviewFlags } from '@/lib/data/record-quality';

type TasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getParam(resolvedSearchParams.created);
  const saved = getParam(resolvedSearchParams.saved);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const statusFilter = getParam(resolvedSearchParams.status).trim();
  const priorityFilter = getParam(resolvedSearchParams.priority).trim();

  const supabase = await createClient();
  const data = await getTasksPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (statusFilter && (row.status ?? '') !== statusFilter) return false;
    if (priorityFilter && (row.priority ?? '') !== priorityFilter) return false;
    if (query && !matchesTaskQuery(row, query)) return false;
    return true;
  });

  const statusOptions = ['open', 'in_progress', 'completed', 'cancelled'];
  const priorityOptions = ['urgent', 'high', 'medium', 'low'];

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Tasks"
        title="Action items and follow-ups"
        description={
          <>
            Track fundraising follow-ups, portfolio company action items, and relationship tasks.
            Link tasks to organizations, contacts, or fundraising accounts for full context.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Active tasks'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/tasks' : '/app/tasks?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewTasks})`,
            variant: 'secondary'
          }
        ]}
      />

      {created === 'task' && <div className="banner bannerSuccess">Task created successfully.</div>}
      {saved === '1' && <div className="banner bannerSuccess">Task updated.</div>}
      {error && <div className="banner bannerError">{error}</div>}

      <div className="grid grid-4">
        <MetricCard label="Open tasks" value={data.openTasks} note={`of ${data.totalTasks} total`} tone="accent" />
        <MetricCard label="Overdue" value={data.overdueTasks} note="Past due date" tone={data.overdueTasks > 0 ? 'review' : 'default'} />
        <MetricCard label="Completed" value={data.completedTasks} note="Finished tasks" tone="success" />
        <MetricCard label="Review queue" value={data.reviewTasks} note="Needs triage" />
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">
                {reviewMode ? 'Review queue' : 'Tasks'} ({filteredRows.length})
              </h2>
            </div>
          </div>

          <form method="get" action="/app/tasks" className="filterBar">
            <input type="text" name="q" placeholder="Search tasks…" defaultValue={query} className="filterInput" />
            <select name="status" defaultValue={statusFilter} className="filterSelect">
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select name="priority" defaultValue={priorityFilter} className="filterSelect">
              <option value="">All priorities</option>
              {priorityOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {reviewMode && <input type="hidden" name="view" value="review" />}
            <button type="submit" className="secondaryButton">Filter</button>
          </form>

          <div className="activityList">
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <div key={row.id} className="activityItem">
                  <div className="splitRow">
                    <div>
                      <strong style={row.status === 'completed' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                        {row.title}
                      </strong>
                      {row.priority && (
                        <span
                          className="badge"
                          style={{
                            marginLeft: '0.5rem',
                            background: row.priority === 'urgent' ? 'var(--review)' : row.priority === 'high' ? 'var(--amber)' : undefined,
                            color: (row.priority === 'urgent' || row.priority === 'high') ? '#fff' : undefined
                          }}
                        >
                          {row.priority}
                        </span>
                      )}
                      {isOverdue(row) && (
                        <span className="badge" style={{ marginLeft: '0.25rem', background: 'var(--review)', color: '#fff' }}>overdue</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge">{row.status ?? 'open'}</span>
                    </div>
                  </div>
                  {row.description && <div className="tableSubtle">{row.description.slice(0, 150)}</div>}
                  <div className="tableSubtle">
                    {[
                      row.organization ? row.organization.name : null,
                      row.contact ? (row.contact.full_name ?? `${row.contact.first_name} ${row.contact.last_name ?? ''}`.trim()) : null,
                      row.due_at ? `Due ${formatDateTime(row.due_at)}` : null
                    ].filter(Boolean).join(' · ') || 'No linked context'}
                    {row.quality === 'review' && (
                      <span style={{ color: 'var(--review)', marginLeft: '0.5rem' }}>
                        ({formatReviewFlags(row.review_flags).join(', ')})
                      </span>
                    )}
                  </div>
                  {row.status !== 'completed' && row.status !== 'cancelled' && (
                    <form action={updateTaskAction} style={{ marginTop: '0.25rem' }}>
                      <input type="hidden" name="task_id" value={row.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button type="submit" className="inlineLink" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Mark complete
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <div className="emptyState">
                <div className="emptyStateTitle">
                  {query || statusFilter || priorityFilter ? 'No matches' : 'No tasks yet'}
                </div>
                <div className="emptyStateBody">
                  {query || statusFilter || priorityFilter
                    ? 'Try broadening your search or clearing filters.'
                    : 'Add your first task using the form.'}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Add task</h2>
              <div className="subtle">Create a new action item.</div>
            </div>
          </div>
          <form action={addTaskAction} className="formStack">
            <div className="formGroup">
              <label htmlFor="title" className="formLabel">Title *</label>
              <input type="text" id="title" name="title" required className="formInput" />
            </div>
            <div className="formGroup">
              <label htmlFor="description" className="formLabel">Description</label>
              <textarea id="description" name="description" rows={3} className="formInput" />
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="priority" className="formLabel">Priority</label>
                <select id="priority" name="priority" defaultValue="medium" className="formInput">
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="formGroup">
                <label htmlFor="due_at" className="formLabel">Due date</label>
                <input type="date" id="due_at" name="due_at" className="formInput" />
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
            <button type="submit" className="primaryButton">Add task</button>
          </form>
        </section>
      </div>
    </div>
  );
}
