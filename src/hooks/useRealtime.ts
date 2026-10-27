import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { refreshAll } from '../api/client';

const TABLES = [
  'et_transactions', 'et_accounts', 'et_categories', 'et_budgets',
  'et_templates', 'et_investments', 'et_investment_contributions',
];

// Refresh on-screen data when this user's rows change on another device.
// Bursts of changes (e.g. a top-up that adds two rows) are batched into one refresh.
export function useRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refreshAll, 300);
    };

    const channel = supabase.channel(`et-${userId}`);
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${userId}` }, refresh);
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${userId}` }, refresh);
      // Delete events can't be filtered by user; they only carry the row id
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
