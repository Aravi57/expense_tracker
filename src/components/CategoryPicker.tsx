import clsx from 'clsx';
import { useCategoryIndex } from '../api/categories';
import type { CategoryKind } from '../lib/types';
import { CategoryIcon } from './CategoryIcon';

// Tap a category, then optionally a subcategory. `value` is the chosen
// category or subcategory id. `parentsOnly` hides subcategories (budgets).
export function CategoryPicker({ kind, value, onChange, parentsOnly }: {
  kind: CategoryKind; value: string | null; onChange: (id: string | null) => void; parentsOnly?: boolean;
}) {
  const idx = useCategoryIndex();
  const tree = idx.tree(kind);
  const root = idx.root(value);
  const selectedRoot = tree.find((c) => c.id === root?.id);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {tree.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)}
            className={clsx('flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-xs transition',
              root?.id === c.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-[var(--surface-2)]')}>
            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
            <span className="line-clamp-2 leading-tight">{c.name}</span>
          </button>
        ))}
      </div>
      {!parentsOnly && selectedRoot && selectedRoot.children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRoot.children.map((s) => (
            <button key={s.id} type="button" onClick={() => onChange(value === s.id ? selectedRoot.id : s.id)}
              className={clsx('rounded-full border px-3 py-1 text-sm transition',
                value === s.id ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-app hover:bg-[var(--surface-2)]')}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
