import Link from 'next/link';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

const errorMessages: Record<string, string> = {
  not_allowed: 'That Google account is not on the current allowlist yet.',
  auth_failed: 'Google sign-in did not complete correctly. Try again.'
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] ?? 'Login failed.' : null;

  return (
    <main className="container">
      <div className="hero">
        <div className="badge">Spice HQ · Fund III CRM</div>
        <h1>Investor memory, pipeline, and operating context in one place.</h1>
        <p>
          Sign in with Google to open the live Fund III dataset and the CRM shell we’re building on top of Supabase.
        </p>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Sign in</h2>
          <p className="subtle">Current access is limited to approved Google accounts.</p>
          {error ? <div className="errorBanner">{error}</div> : null}
          <div style={{ marginTop: 16 }}>
            <GoogleSignInButton />
          </div>
          <div style={{ marginTop: 12 }} className="subtle">
            If the button does nothing on Vercel, the project is usually missing the two public Supabase env vars.
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">What’s live already</h2>
          <div className="activityList">
            <div className="activityItem">Clean Supabase CRM schema is live</div>
            <div className="activityItem">1,019 Airtable investor rows imported</div>
            <div className="activityItem">Fundraising table is now the first real data surface</div>
            <div className="activityItem">Next layers: contacts, interactions, Gmail, Calendar, Drive</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/app" className="secondaryButton">Open app</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
