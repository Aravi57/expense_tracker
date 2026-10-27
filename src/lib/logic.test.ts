import { describe, expect, it, vi } from 'vitest';
import { buildCategoryIndex } from '../api/categories';
import { budget, catTotal, categories, txn } from '../test/fixtures';
import { daysLeftInPeriod, groupBudgets, monthlyOverview } from './budget';
import { downloadCsv } from './csv';
import { buildInsights } from './insights';
import { groupByDay, netOf } from './transactions';

describe('category index', () => {
  const idx = buildCategoryIndex(categories);

  it('builds a tree of top-level categories per kind', () => {
    expect(idx.tree('expense').map((c) => c.name)).toEqual(['Home', 'Food']);
    expect(idx.tree('expense')[0].children.map((c) => c.name)).toEqual(['Rent', 'Other']);
    expect(idx.tree('income').map((c) => c.name)).toEqual(['Salary']);
  });

  it('finds the top-level category of a subcategory', () => {
    expect(idx.root('home-rent')?.name).toBe('Home');
    expect(idx.root('food')?.name).toBe('Food');
    expect(idx.root(null)).toBeUndefined();
  });

  it('labels subcategories with their parent, hiding a plain "Other"', () => {
    expect(idx.label('home-rent')).toBe('Home › Rent');
    expect(idx.label('home-other')).toBe('Home');
    expect(idx.label('food')).toBe('Food');
    expect(idx.label(null)).toBe('Uncategorised');
    expect(idx.label('deleted-id')).toBe('Uncategorised');
  });

  it('expands a category to include its subcategories for filtering', () => {
    expect(idx.withChildren('home')).toEqual(['home', 'home-rent', 'home-other']);
    expect(idx.withChildren('food')).toEqual(['food']);
  });
});

describe('daysLeftInPeriod', () => {
  const wed = new Date(2026, 9, 28, 10); // Wednesday 28 Oct 2026

  it('counts to the end of the week (Monday start)', () => {
    expect(daysLeftInPeriod('weekly', wed)).toBe(5); // Wed–Sun
    expect(daysLeftInPeriod('weekly', new Date(2026, 10, 1, 10))).toBe(1); // Sunday
  });

  it('counts to the end of the month and year', () => {
    expect(daysLeftInPeriod('monthly', wed)).toBe(4); // 28–31 Oct
    expect(daysLeftInPeriod('yearly', new Date(2026, 11, 31, 10))).toBe(1);
  });
});

describe('budget groups', () => {
  const rootOf = (id: string) => buildCategoryIndex(categories).root(id)?.id;

  it('puts subcategory budgets under their main category, keeping the chosen order', () => {
    const groups = groupBudgets([
      budget({ id: 'food', category_id: 'food', amount: 3000, spent: 500 }),
      budget({ id: 'rent', category_id: 'home-rent', amount: 15000, spent: 15000 }),
      budget({ id: 'other', category_id: 'home-other', amount: 2000, spent: 300 }),
    ], rootOf);
    expect(groups.map((g) => [g.rootId, g.budgets.map((b) => b.id)])).toEqual([['food', ['food']], ['home', ['rent', 'other']]]);
  });

  it('adds up subcategory budgets when there is no main-category budget', () => {
    const [home] = groupBudgets([
      budget({ id: 'rent', category_id: 'home-rent', amount: 15000, spent: 15000 }),
      budget({ id: 'other', category_id: 'home-other', amount: 2000, spent: 300 }),
    ], rootOf);
    expect(home.total).toEqual({ amount: 17000, spent: 15300, period: 'monthly' });
  });

  it('uses the main-category budget as the total, since it already includes its subcategories', () => {
    const [home] = groupBudgets([
      budget({ id: 'rent', category_id: 'home-rent', amount: 15000, spent: 15000 }),
      budget({ id: 'main', category_id: 'home', amount: 20000, spent: 15300 }),
    ], rootOf);
    expect(home.main?.id).toBe('main');
    expect(home.budgets.map((b) => b.id)).toEqual(['main', 'rent']);
    expect(home.total).toEqual({ amount: 20000, spent: 15300, period: 'monthly' });
  });

  it('has no single total when subcategory budgets reset on different schedules', () => {
    const [home] = groupBudgets([
      budget({ id: 'rent', category_id: 'home-rent', period: 'monthly' }),
      budget({ id: 'other', category_id: 'home-other', period: 'weekly' }),
    ], rootOf);
    expect(home.total).toBeNull();
  });

  it('counts spending once in the monthly overview', () => {
    const groups = groupBudgets([
      budget({ id: 'main', category_id: 'home', amount: 20000, spent: 15300 }),
      budget({ id: 'rent', category_id: 'home-rent', amount: 15000, spent: 15000 }),
      budget({ id: 'food', category_id: 'food', amount: 3000, spent: 500 }),
      budget({ id: 'wk', category_id: 'food', amount: 900, spent: 100, period: 'weekly' }),
    ], rootOf);
    expect(monthlyOverview(groups)).toEqual({ amount: 23000, spent: 15800 });
  });
});

describe('transaction grouping', () => {
  const list = [
    txn({ occurred_on: '2026-10-12', type: 'income', amount: 1000 }),
    txn({ occurred_on: '2026-10-12', type: 'expense', amount: 300 }),
    txn({ occurred_on: '2026-10-11', type: 'transfer', amount: 500 }),
    txn({ occurred_on: '2026-10-10', type: 'expense', amount: 50 }),
  ];

  it('groups by day and keeps newest-first order', () => {
    const groups = groupByDay(list);
    expect(groups.map(([d, items]) => [d, items.length])).toEqual([['2026-10-12', 2], ['2026-10-11', 1], ['2026-10-10', 1]]);
  });

  it('nets income against expenses and ignores transfers', () => {
    expect(netOf(list)).toBe(650);
    expect(netOf([list[2]])).toBe(0);
  });
});

describe('insights', () => {
  const base = { income: 0, expense: 0, weekendExpense: 0, categories: [], previousCategories: null, budgets: [] };

  it('says nothing when there is no data', () => {
    expect(buildInsights(base)).toEqual([]);
  });

  it('praises a savings rate of 20% or more', () => {
    const [first] = buildInsights({ ...base, income: 1000, expense: 700 });
    expect(first).toEqual({ tone: 'good', text: 'You saved 30% of your income. Keep it up.' });
  });

  it('warns when spending exceeds income', () => {
    const [first] = buildInsights({ ...base, income: 1000, expense: 1500 });
    expect(first.tone).toBe('warn');
    expect(first.text).toContain('₹500 more than you earned');
  });

  it('flags categories up more than 25% (and ₹500) on last month', () => {
    const out = buildInsights({
      ...base, expense: 3000,
      categories: [catTotal('Food', 2000), catTotal('Home', 1000)],
      previousCategories: [catTotal('Food', 1000), catTotal('Home', 900)],
    });
    expect(out.filter((i) => i.text.includes('up'))).toHaveLength(1);
    expect(out.some((i) => i.text.startsWith('Food spending is up 100%'))).toBe(true);
  });

  it('reports budget health', () => {
    const over = buildInsights({ ...base, budgets: [budget({ spent: 1200 }), budget({ id: 'b2', spent: 10 })] });
    expect(over).toContainEqual({ tone: 'warn', text: '1 of 2 budgets are over their limit right now.' });
    const fine = buildInsights({ ...base, budgets: [budget({ spent: 10 })] });
    expect(fine).toContainEqual({ tone: 'good', text: 'All 1 budgets are within their limits right now.' });
  });

  it('notes heavy weekend spending and the biggest category', () => {
    const out = buildInsights({ ...base, expense: 1000, weekendExpense: 600, categories: [catTotal('Food', 400)] });
    expect(out).toContainEqual({ tone: 'info', text: '60% of spending happened at weekends.' });
    expect(out).toContainEqual({ tone: 'info', text: 'Food is your biggest expense at 40% of spending.' });
  });
});

describe('downloadCsv', () => {
  it('escapes commas, quotes and newlines and adds a BOM for Excel', async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b as Blob; return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('out.csv', ['Name', 'Note'], [['Tea, coffee', 'He said "hi"'], ['Line\nbreak', null]]);

    expect(click).toHaveBeenCalledOnce();
    // Blob.text() drops a leading BOM, so check the raw bytes for it
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('Name,Note\n"Tea, coffee","He said ""hi"""\n"Line\nbreak",');
  });
});
