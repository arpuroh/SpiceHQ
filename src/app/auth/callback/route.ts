import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appConfig } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const email = data.user?.email?.toLowerCase();
      if (email && appConfig.allowedEmails.includes(email as (typeof appConfig.allowedEmails)[number])) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_allowed`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
