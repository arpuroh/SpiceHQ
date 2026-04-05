import Link from 'next/link';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

export default function LoginPage() {
  return (
    <main className="container">
      <div className="hero">
        <div className="badge">Spice Capital · Fund III CRM</div>
        <h1>Fundraising memory, workflow, and investor intelligence in one place.</h1>
        <p>
          Track LP conversations, next steps, documents, transcripts, and relationship context so you can run
          Fund III with real continuity instead of scattered notes.
        </p>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Sign in</h2>
          <p className="subtle">Use your approved Google account to access the internal CRM.</p>
          <div style={{ marginTop: 16 }}>
            <GoogleSignInButton />
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">What this CRM will do</h2>
          <div className="activityList">
            <div className="activityItem">Track Fund III pipeline, notes, and next steps</div>
            <div className="activityItem">Auto-link contacts, interactions, transcripts, and documents</div>
            <div className="activityItem">Surface who to meet when you travel to a city</div>
            <div className="activityItem">Generate personalized follow-up prompts and investor memory</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/app" className="secondaryButton">View prototype shell</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
