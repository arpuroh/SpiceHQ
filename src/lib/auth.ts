import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appConfig } from '@/lib/config';

export async function requireAllowedUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();

  if (!email || !appConfig.allowedEmails.includes(email as (typeof appConfig.allowedEmails)[number])) {
    redirect('/login?error=not_allowed');
  }

  return { supabase, user, email };
}
