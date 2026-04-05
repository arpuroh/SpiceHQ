import { requireAllowedUser } from '@/lib/auth';
import { AppNav } from '@/components/app-nav';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { email } = await requireAllowedUser();

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div>
          <div className="brand">Spice HQ</div>
          <div className="subtle" style={{ marginTop: 6 }}>Fund III operating system</div>
        </div>

        <AppNav />

        <div className="sidebarFooter subtle">
          Signed in as<br />
          <strong style={{ color: 'var(--text)' }}>{email}</strong>
        </div>
      </aside>

      <main className="mainContent">{children}</main>
    </div>
  );
}
