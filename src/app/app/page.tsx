import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getFundraisingPageData, formatUsd } from '@/lib/data/fundraising';

export default async function AppPage() {
  const supabase = await createClient();
  const data = await getFundraisingPageData(supabase, {
    query: null,
    stage: null,
    status: null,
    organizationType: null
  });

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Live CRM overview</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Now there’s actual data underneath this.</h1>
          <div className="subtle">
            Airtable investors have started landing in Supabase. This is the first usable surface while the rest of the CRM gets built out.
          </div>
        </div>
        <Link href="/app/fundraising" className="primaryButton">Open fundraising table</Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Organizations</div><div className="kpiValue">{data.totalOrganizations}</div></section>
        <section className="panel"><div className="kpiTitle">Fundraising accounts</div><div className="kpiValue">{data.totalAccounts}</div></section>
        <section className="panel"><div className="kpiTitle">Soft circled</div><div className="kpiValue">{formatUsd(data.totalSoftCircled)}</div></section>
        <section className="panel"><div className="kpiTitle">Committed</div><div className="kpiValue">{formatUsd(data.totalCommitted)}</div></section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Stage breakdown</h2>
          <div className="stageList">
            {data.stageCounts.length ? data.stageCounts.map((item) => (
              <div key={item.stage} className="stageItem">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item.stage}</strong>
                  <span className="badge">{item.count}</span>
                </div>
              </div>
            )) : <div className="activityItem">No live rows yet.</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">What’s live already</h2>
          <div className="activityList">
            <div className="activityItem">Supabase schema is live</div>
            <div className="activityItem">1,019 investor rows imported into normalized tables</div>
            <div className="activityItem">Airtable export staging is working locally</div>
            <div className="activityItem">Next step is deeper views, editing, and sync controls</div>
          </div>
        </section>
      </div>
    </div>
  );
}
