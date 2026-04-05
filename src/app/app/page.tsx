import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appConfig } from '@/lib/config';

const pipelineSummary = [
  { stage: 'Sourced', count: 42 },
  { stage: 'Intro Requested', count: 18 },
  { stage: 'First Meeting', count: 11 },
  { stage: 'Diligence', count: 7 },
  { stage: 'Soft Circled', count: 4 },
  { stage: 'Committed', count: 2 }
];

const recentActivity = [
  { title: 'Baupost family office follow-up drafted', meta: 'Last touch 12 days ago · next step due Tuesday' },
  { title: 'Investor update PDF ingested for March 2026', meta: '3 companies updated · 1 LP digest pending' },
  { title: 'SF trip meeting candidates prepared', meta: '11 LPs in Bay Area · 4 high priority' },
  { title: 'MUVISPV2 legacy outreach cohort identified', meta: '182 contacts · 29 high-priority re-engagements' }
];

const topContacts = [
  { name: 'Example LP Partner', org: 'Founders Fund of Funds', stage: 'Diligence', lastTouch: '9 days ago', nextStep: 'Send updated portfolio construction memo' },
  { name: 'Example Family Office CIO', org: 'West Coast Capital', stage: 'First Meeting', lastTouch: '3 days ago', nextStep: 'Schedule follow-up in SF' },
  { name: 'Example Seed Lead', org: 'XYZ Ventures', stage: 'Relationship', lastTouch: '27 days ago', nextStep: 'Re-engage on portco round fit' }
];

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();

  if (!email || !appConfig.allowedEmails.includes(email as (typeof appConfig.allowedEmails)[number])) {
    redirect('/login');
  }

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <div className="brand">Spice HQ</div>
          <div className="subtle">Fund III operating system · signed in as {email}</div>
        </div>
        <div className="badge">Prototype shell connected to Supabase auth</div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Pipeline organizations</div><div className="kpiValue">84</div><div className="subtle">Across Fund III active funnel</div></section>
        <section className="panel"><div className="kpiTitle">Soft circled</div><div className="kpiValue">$9.4M</div><div className="subtle">Rolling target for current close</div></section>
        <section className="panel"><div className="kpiTitle">Stale follow-ups</div><div className="kpiValue">13</div><div className="subtle">No touch in 30+ days</div></section>
        <section className="panel"><div className="kpiTitle">Upcoming travel intelligence</div><div className="kpiValue">11</div><div className="subtle">SF contacts worth meeting next trip</div></section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Fund III pipeline snapshot</h2>
          <div className="stageList">
            {pipelineSummary.map((item) => (
              <div className="stageItem" key={item.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item.stage}</strong>
                  <span className="badge">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Automation targets we’re building</h2>
          <div className="activityList">
            <div className="activityItem">Trip planning: “I’m going to SF — who should I meet?”</div>
            <div className="activityItem">Monthly investor update PDFs + structured traction snapshots</div>
            <div className="activityItem">Transcript-linked contact memory + quarterly follow-up reminders</div>
            <div className="activityItem">Best next investors for portco fundraising matches</div>
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Recent CRM activity</h2>
          <div className="activityList">
            {recentActivity.map((item) => (
              <div className="activityItem" key={item.title}>
                <strong>{item.title}</strong>
                <div className="subtle" style={{ marginTop: 6 }}>{item.meta}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Priority relationships</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Organization</th>
                <th>Stage</th>
                <th>Last Touch</th>
                <th>Next Step</th>
              </tr>
            </thead>
            <tbody>
              {topContacts.map((contact) => (
                <tr key={contact.name}>
                  <td>{contact.name}</td>
                  <td>{contact.org}</td>
                  <td>{contact.stage}</td>
                  <td>{contact.lastTouch}</td>
                  <td>{contact.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
