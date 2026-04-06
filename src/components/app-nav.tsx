'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  {
    href: '/app',
    label: 'Overview',
    meta: 'Fund health, queue pressure, and operating summary'
  },
  {
    href: '/app/fundraising',
    label: 'Fundraising',
    meta: 'Pipeline, stages, commitments, and investor coverage'
  },
  {
    href: '/app/organizations',
    label: 'Organizations',
    meta: 'Investor directory, firm details, and relationship context'
  },
  {
    href: '/app/contacts',
    label: 'Contacts',
    meta: 'People records and relationship ownership'
  },
  {
    href: '/app/interactions',
    label: 'Interactions',
    meta: 'Conversation history, touchpoints, and activity log'
  },
  {
    href: '/app/portfolio',
    label: 'Portfolio',
    meta: 'Portfolio companies, investments, and valuations'
  },
  {
    href: '/app/tasks',
    label: 'Tasks',
    meta: 'Action items, follow-ups, and deadlines'
  },
  {
    href: '/app/notes',
    label: 'Notes',
    meta: 'Meeting notes, memos, and relationship context'
  }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <div>
      <div className="sidebarSectionLabel">Workspace</div>
      <nav className="sidebarNav">
      {nav.map((item) => {
        const isActive = item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link key={item.href} href={item.href} className={`navLink${isActive ? ' navLinkActive' : ''}`}>
            <span className="navLinkLabel">{item.label}</span>
            <span className="navLinkMeta">{item.meta}</span>
          </Link>
        );
      })}
      </nav>
    </div>
  );
}
