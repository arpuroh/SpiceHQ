'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/app', label: 'Overview' },
  { href: '/app/organizations', label: 'Organizations' },
  { href: '/app/fundraising', label: 'Fundraising' },
  { href: '/app/contacts', label: 'Contacts' },
  { href: '/app/interactions', label: 'Interactions' },
  { href: '/app/tasks', label: 'Tasks' },
  { href: '/app/notes', label: 'Notes' },
  { href: '/app/portfolio', label: 'Portfolio' }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebarNav">
      {nav.map((item) => {
        const isActive = item.href === '/app'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link key={item.href} href={item.href} className={`navLink${isActive ? ' navLinkActive' : ''}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
