import { requireAllowedUser } from '@/lib/auth';
import { AppNav } from '@/components/app-nav';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { email } = await requireAllowedUser();

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandLockup">
          <div className="brandBadge">Internal CRM</div>
          <div>
            <div className="brand">Spice HQ</div>
            <div className="subtle" style={{ marginTop: 6 }}>Fund III operating system</div>
          </div>
        </div>

        <AppNav />

        <div className="sidebarFooter subtle">
          Workspace access<br />
          <strong style={{ color: 'var(--text)' }}>{email}</strong>
        </div>
      </aside>

      <main className="mainContent">
        <div className="contentFrame">
          <div className="container">
            <div className="shellTopbar">
              <div>
                <div className="shellTitle">Investor CRM workspace</div>
                <div className="shellMeta">Searchable pipeline, contacts, and interaction history backed by Supabase.</div>
              </div>
              <div className="sourceBadge">Authenticated session</div>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
