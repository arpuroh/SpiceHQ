import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatUsd, getFundraisingPageData } from '@/lib/data/fundraising';

export default async function FundraisingPage() {
  const supabase = await createClient();
  const data = await getFundraisingPageData(supabase);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Fundraising</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Investor / fundraising table</h1>
          <div className="subtle">
            Default view now suppresses placeholder accounts and lifts rows with real organization, relationship, and capital signal.
          </div>
        </div>
        <div className="buttonRow">
          <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
          <Link href="/app/review" className="secondaryButton">Review hidden rows</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Visible accounts</div><div className="kpiValue">{data.visibleAccounts}</div><div className="metricNote">{data.hiddenAccounts} hidden</div></section>
        <section className="panel"><div className="kpiTitle">Target</div><div className="kpiValue">{formatUsd(data.totalTarget)}</div></section>
        <section className="panel"><div className="kpiTitle">Soft circled</div><div className="kpiValue">{formatUsd(data.totalSoftCircled)}</div></section>
        <section className="panel"><div className="kpiTitle">Committed</div><div className="kpiValue">{formatUsd(data.totalCommitted)}</div></section>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Curated accounts</h2>
            <div className="subtle">Sorted toward accounts with real organizations, financial signal, and relationship context.</div>
          </div>
          <div className="badge">{data.totalAccounts} imported total</div>
        </div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Stage</th>
                <th>Type</th>
                <th>HQ</th>
                <th>Probability</th>
                <th>Target</th>
                <th>Soft circled</th>
                <th>Committed</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length ? data.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                    <div className="tableSubtle">{row.organization?.tags?.slice(0, 3).join(' · ') || 'No tags yet'}</div>
                  </td>
                  <td>{row.stage}</td>
                  <td>{row.organization?.organization_type ?? '—'}</td>
                  <td>{row.organization?.headquarters ?? '—'}</td>
                  <td>{row.probability_pct ?? '—'}{row.probability_pct !== null ? '%' : ''}</td>
                  <td>{formatUsd(row.target_commitment)}</td>
                  <td>{formatUsd(row.soft_circled_amount)}</td>
                  <td>{formatUsd(row.committed_amount)}</td>
                  <td>{row.memo ?? '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="subtle">No fundraising rows available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.hiddenRows.length ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panelHeader">
            <div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Suppressed fundraising rows</h2>
              <div className="subtle">These rows remain accessible for cleanup and source-data triage.</div>
            </div>
            <div className="badge">{data.hiddenRows.length} suspect rows</div>
          </div>

          <div className="activityList">
            {data.hiddenRows.slice(0, 12).map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                <div className="tableSubtle">
                  {row.stage} · {formatUsd(row.target_commitment)} target · {row.relationship_temperature ?? 'No relationship signal'}
                </div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <div className="reasonList">
                  {reasons.map((reason) => (
                    <div key={`${row.id}-${reason.code}-detail`} className="tableSubtle">{reason.detail}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
