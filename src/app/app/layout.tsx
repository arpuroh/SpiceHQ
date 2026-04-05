import Link from 'next/link';
import { requireAllowedUser } from '@/lib/auth';

const nav = [
  { href: '/app', label: 'Overview' },
  { href: '/app/fundraising', label: 'Fundraising' }
];

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { email } = await requireAllowedUser();

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div>
          <div className="brand">Spice HQ</div>
          <div className="subtle" style={{ marginTop: 6 }}>Fund III operating system</div>
        </div>

        <nav className="sidebarNav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="navLink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebarFooter subtle">
          Signed in as<br />
          <strong style={{ color: 'var(--text)' }}>{email}</strong>
        </div>
      </aside>

      <main className="mainContent">{children}</main>
    </div>
  );
}
