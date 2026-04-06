import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioDetailData, formatUsd, formatDate } from '@/lib/data/portfolio';
import { formatReviewFlags } from '@/lib/data/record-quality';

type PortfolioDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortfolioDetailPage({ params, searchParams }: PortfolioDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = Array.isArray(resolvedSearchParams.saved) ? resolvedSearchParams.saved[0] : resolvedSearchParams.saved;

  const supabase = await createClient();
  const company = await getPortfolioDetailData(supabase, id);

  if (!company) notFound();

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Portfolio"
        title={company.company_name}
        description={
          <>
            {[company.sector, company.headquarters].filter(Boolean).join(' · ') || 'Portfolio company details'}
            {company.quality === 'review' && (
              <span style={{ color: 'var(--review)', marginLeft: '0.5rem' }}>
                Review: {formatReviewFlags(company.review_flags).join(', ')}
              </span>
            )}
          </>
        }
        meta={
          <>
            <div className="badge">{company.status ?? 'active'}</div>
            <div className="badge">{company.stage ?? 'No stage'}</div>
          </>
        }
        actions={[
          { href: '/app/portfolio', label: 'Back to portfolio', variant: 'secondary' }
        ]}
      />

      {saved === '1' && <div className="banner bannerSuccess">Company updated.</div>}

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Investment details</h2>
            </div>
          </div>
          <div className="insightList">
            <div className="insightItem">
              <span className="insightValue">Investment amount</span>
              <div>{formatUsd(company.investment_amount)}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Entry valuation</span>
              <div>{formatUsd(company.valuation_at_entry)}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Current valuation</span>
              <div>{formatUsd(company.current_valuation)}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Ownership</span>
              <div>{company.ownership_percentage != null ? `${company.ownership_percentage}%` : '—'}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Board seat</span>
              <div>{company.board_seat ? 'Yes' : 'No'}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Investment date</span>
              <div>{formatDate(company.investment_date)}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Lead partner</span>
              <div>{company.lead_partner ?? '—'}</div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Company info</h2>
            </div>
          </div>
          <div className="insightList">
            <div className="insightItem">
              <span className="insightValue">Sector</span>
              <div>{company.sector ?? '—'}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Headquarters</span>
              <div>{company.headquarters ?? '—'}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Website</span>
              <div>
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="inlineLink">
                    {company.website}
                  </a>
                ) : '—'}
              </div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Founded</span>
              <div>{company.founded_year ?? '—'}</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Employees</span>
              <div>{company.employee_count ?? '—'}</div>
            </div>
            {company.organization && (
              <div className="insightItem">
                <span className="insightValue">Linked organization</span>
                <div>
                  <Link href={`/app/organizations/${company.organization.id}`} className="inlineLink">
                    {company.organization.name}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {company.description && (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Description</h2>
            </div>
          </div>
          <div style={{ padding: '1rem 1.25rem' }}>
            <p>{company.description}</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">Founders & team</h2>
            <div className="subtle">{company.founders.length} linked contact{company.founders.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {company.founders.length ? (
          <div className="tableWrap">
            <table className="table tableCompact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Title</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {company.founders.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/app/contacts/${f.id}`} className="tableTitle">
                        {f.full_name ?? `${f.first_name} ${f.last_name ?? ''}`.trim()}
                      </Link>
                      {f.is_primary && <span className="badge" style={{ marginLeft: '0.5rem' }}>primary</span>}
                    </td>
                    <td>{f.role ?? '—'}</td>
                    <td>{f.job_title ?? '—'}</td>
                    <td>{f.email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ padding: '1.5rem' }}>
            <div className="emptyStateTitle">No founders linked yet</div>
            <div className="emptyStateBody">
              Link contacts to this portfolio company through the database to see them here.
            </div>
          </div>
        )}
      </section>

      {company.notes && (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Notes</h2>
            </div>
          </div>
          <div style={{ padding: '1rem 1.25rem' }}>
            <p>{company.notes}</p>
          </div>
        </section>
      )}
    </div>
  );
}
