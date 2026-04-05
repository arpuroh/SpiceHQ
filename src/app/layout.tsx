import './globals.css';
import type { Metadata } from 'next';
import { appConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: `${appConfig.appName} · Fund III`,
  description: 'Internal CRM for Spice Capital Fund III fundraising and relationship management.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
