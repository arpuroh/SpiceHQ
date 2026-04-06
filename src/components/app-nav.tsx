'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/app', label: 'Overview' },
  { href: '/app/fundraising', label: 'Fundraising' },
  { href: '/app/contacts', label: 'Contacts' },
  { href: '/app/interactions', label: 'Interactions' },
  { href: '/app/review', label: 'Review Queue' }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebarNav">
      {nav.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href} className={`navLink${isActive ? ' navLinkActive' : ''}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
