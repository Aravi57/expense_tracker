import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase, usernameToEmail } from '../lib/supabase';
import { queryClient } from '../api/client';
import { processRecurring } from '../api/recurring';

interface AuthState {
  session: Session | null;
  loading: boolean;
  username: string;
  fullname: string;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (fullname: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// First sign-in on a device: make sure the user has categories and that any
// recurring transactions that came due while they were away are created.
async function prepareUser() {
  await supabase.rpc('et_seed_categories');
  const created = await processRecurring().catch(() => 0);
  await queryClient.invalidateQueries();
  if (created) toast.success(`Recorded ${created} recurring transaction${created === 1 ? '' : 's'}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) prepareUser();
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') setTimeout(prepareUser, 0);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const meta = session?.user.user_metadata ?? {};

  const value: AuthState = {
    session,
    loading,
    username: meta.username ?? '',
    fullname: meta.fullname ?? '',
    async signIn(username, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error) throw new Error('Incorrect username or password');
    },
    async signUp(fullname, username, password) {
      const { data, error } = await supabase.auth.signUp({
        email: usernameToEmail(username),
        password,
        options: { data: { fullname: fullname.trim(), username: username.trim() } },
      });
      if (error) {
        throw new Error(/already registered/i.test(error.message) ? 'That username is taken. Please choose another.' : error.message);
      }
      if (!data.session) throw new Error('Sign-up needs "Confirm email" turned off in Supabase.');
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
