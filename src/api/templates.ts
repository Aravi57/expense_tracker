import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import { today } from '../lib/dates';
import type { Template } from '../lib/types';

// Most-used templates first, then the order they were made in
export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('et_templates').select('*').order('use_count', { ascending: false }).order('created_at'),
      ) as Template[];
      return rows.map((t) => ({ ...t, amount: t.amount == null ? null : Number(t.amount) }));
    },
  });
}

export type TemplateInput = Omit<Template, 'id' | 'sort_order' | 'use_count' | 'last_used_at'> & { id?: string };

export async function saveTemplate(t: TemplateInput) {
  const transfer = t.type === 'transfer';
  const row = {
    name: t.name.trim(),
    type: t.type,
    amount: t.amount,
    description: t.description.trim(),
    category_id: transfer ? null : t.category_id,
    account_id: t.account_id,
    to_account_id: transfer ? t.to_account_id : null,
  };
  if (t.id) unwrap(await supabase.from('et_templates').update(row).eq('id', t.id));
  else unwrap(await supabase.from('et_templates').insert(row));
}

export async function deleteTemplate(id: string) {
  unwrap(await supabase.from('et_templates').delete().eq('id', id));
}

// Add a transaction from a template (dated today); returns the new transaction's id
export async function addFromTemplate(templateId: string, amount?: number) {
  return unwrap(await supabase.rpc('et_use_template', { p_template: templateId, p_date: today(), p_amount: amount ?? null })) as string;
}
