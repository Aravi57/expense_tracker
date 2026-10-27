import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase, unwrap } from '../lib/supabase';
import type { Category, CategoryKind } from '../lib/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      unwrap(await supabase.from('et_categories').select('*').order('sort_order').order('name')) as Category[],
    staleTime: 10 * 60_000,
  });
}

export interface CategoryNode extends Category {
  children: Category[];
}

// Lookup helpers built once per category list
export function useCategoryIndex() {
  const { data } = useCategories();
  return useMemo(() => buildCategoryIndex(data ?? []), [data]);
}

export type CategoryIndex = ReturnType<typeof buildCategoryIndex>;

export function buildCategoryIndex(data: Category[]) {
  const byId = new Map(data.map((c) => [c.id, c]));
  const tree = (kind: CategoryKind): CategoryNode[] =>
    data
      .filter((c) => c.kind === kind && !c.parent_id)
      .map((c) => ({ ...c, children: data.filter((s) => s.parent_id === c.id) }));

  // The top-level category for a category or subcategory id
  const root = (id: string | null | undefined) => {
    const c = id ? byId.get(id) : undefined;
    return c?.parent_id ? byId.get(c.parent_id) : c;
  };

  // "Home › Rent", or just "Home" (a lone "Other" subcategory adds nothing)
  const label = (id: string | null | undefined) => {
    const c = id ? byId.get(id) : undefined;
    if (!c) return 'Uncategorised';
    if (!c.parent_id) return c.name;
    const p = byId.get(c.parent_id);
    return p ? (c.name === 'Other' || c.name === p.name ? p.name : `${p.name} › ${c.name}`) : c.name;
  };

  // A category id plus all of its subcategory ids (for filtering)
  const withChildren = (id: string) => [id, ...data.filter((c) => c.parent_id === id).map((c) => c.id)];

  return { all: data, byId, tree, root, label, withChildren };
}

export async function saveCategory(c: Partial<Category> & Pick<Category, 'name' | 'kind'>) {
  const row = {
    name: c.name.trim(),
    kind: c.kind,
    parent_id: c.parent_id ?? null,
    icon: c.icon ?? 'Tag',
    color: c.color ?? '#94a3b8',
    sort_order: c.sort_order ?? 999,
  };
  if (c.id) unwrap(await supabase.from('et_categories').update(row).eq('id', c.id));
  else unwrap(await supabase.from('et_categories').insert(row));
}

// Find a subcategory of `parent` by name (ignoring case), or create it; returns its id
export async function ensureSubcategory(parent: Category, name: string, existing: Category[]) {
  const clean = name.trim().replace(/\s+/g, ' ');
  const match = existing.find((c) => c.parent_id === parent.id && c.name.toLowerCase() === clean.toLowerCase());
  if (match) return match.id;
  const siblings = existing.filter((c) => c.parent_id === parent.id);
  const row = unwrap(await supabase.from('et_categories').insert({
    name: clean,
    kind: parent.kind,
    parent_id: parent.id,
    icon: parent.icon,
    color: parent.color,
    sort_order: Math.max(0, ...siblings.map((c) => c.sort_order)) + 1,
  }).select('id').single()) as { id: string };
  return row.id;
}

export async function deleteCategory(id: string) {
  unwrap(await supabase.from('et_categories').delete().eq('id', id));
}
