'use client';

import { createClient } from '@/lib/supabase/client';

export function GoogleSignInButton() {
  async function signIn() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });
  }

  return (
    <button className="primaryButton" onClick={signIn}>
      Continue with Google
    </button>
  );
}
