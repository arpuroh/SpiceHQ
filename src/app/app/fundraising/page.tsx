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
            First real data-backed table from Supabase. Sorted by target commitment. Showing the top 250 rows for now.
          </div>
        </div>
        <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Accounts</div><div className="kpiValue">{data.totalAccounts}</div></section>
        <section className="panel"><div className="kpiTitle">Target</div><div className="kpiValue">{formatUsd(data.totalTarget)}</div></section>
        <section className="panel"><div className="kpiTitle">Soft circled</div><div className="kpiValue">{formatUsd(data.totalSoftCircled)}</div></section>
        <section className="panel"><div className="kpiTitle">Committed</div><div className="kpiValue">{formatUsd(data.totalCommitted)}</div></section>
      </div>

      <section className="panel">
        <h2 className="sectionTitle">Accounts</h2>
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
    </div>
  );
}
