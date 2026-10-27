import { createClient } from '@supabase/supabase-js';

// The publishable key is meant to be public; row level security in
// supabase/migrations keeps each user's data private.
const SUPABASE_URL = 'https://kuwuqcctqcldbwblbnfs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fmU9yJOvlbguA4M2Z7_4MQ_oRtAux0E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Supabase Auth needs an email, so each username maps to a fixed address on the
// reserved .invalid domain, which can never receive mail. Users only see their username.
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@expense-tracker.invalid`;
}

// Throw Supabase errors so TanStack Query treats them as failures
export function unwrap<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}
