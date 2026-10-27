import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { categories } from '../test/fixtures';
import { CategoryPicker } from './CategoryPicker';
import { ProgressBar, Segmented, Sheet, Trend } from './ui';

describe('CategoryPicker', () => {
  // CategoryPicker reads categories through TanStack Query; pre-fill the cache so nothing is fetched
  function Harness({ parentsOnly }: { parentsOnly?: boolean }) {
    const [client] = useState(() => {
      const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
      qc.setQueryData(['categories'], categories);
      return qc;
    });
    const [value, setValue] = useState<string | null>(null);
    return (
      <QueryClientProvider client={client}>
        <CategoryPicker kind="expense" value={value} onChange={setValue} parentsOnly={parentsOnly} />
        <output data-testid="value">{value ?? 'none'}</output>
      </QueryClientProvider>
    );
  }

  it('shows only categories of the requested kind', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Food' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salary' })).not.toBeInTheDocument();
  });

  it('picks a category, then a subcategory, and toggles the subcategory off again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Rent' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('value')).toHaveTextContent('home');

    await user.click(screen.getByRole('button', { name: 'Rent' }));
    expect(screen.getByTestId('value')).toHaveTextContent('home-rent');

    await user.click(screen.getByRole('button', { name: 'Rent' }));
    expect(screen.getByTestId('value')).toHaveTextContent('home');
  });

  it('hides subcategories when only parents may be chosen', async () => {
    const user = userEvent.setup();
    render(<Harness parentsOnly />);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.queryByRole('button', { name: 'Rent' })).not.toBeInTheDocument();
  });
});

describe('Segmented', () => {
  it('marks the chosen option and reports changes', async () => {
    const onChange = vi.fn();
    render(<Segmented value="a" onChange={onChange} options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ProgressBar', () => {
  it('caps the bar at 100% but reports the real value', () => {
    render(<ProgressBar value={150} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' });
    expect(bar.firstElementChild).toHaveClass('bg-rose-500');
  });

  it('turns amber from 80% and stays green below', () => {
    const { rerender } = render(<ProgressBar value={85} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-amber-500');
    rerender(<ProgressBar value={40} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-emerald-500');
  });
});

describe('Trend', () => {
  it('shows a rise in spending as bad and a fall as good', () => {
    const { rerender } = render(<Trend value={20} goodWhenUp={false} />);
    expect(screen.getByText(/20% vs last month/)).toHaveClass('text-rose-600');
    rerender(<Trend value={-20} goodWhenUp={false} />);
    expect(screen.getByText(/20% vs last month/)).toHaveClass('text-emerald-600');
  });

  it('explains when there is nothing to compare', () => {
    render(<Trend value={null} />);
    expect(screen.getByText('No earlier data')).toBeInTheDocument();
  });
});

describe('Sheet', () => {
  it('renders its content only while open and closes from the close button', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sheet open={false} onClose={onClose} title="Edit">Body text</Sheet>);
    expect(screen.queryByText('Body text')).not.toBeInTheDocument();

    rerender(<Sheet open onClose={onClose} title="Edit">Body text</Sheet>);
    expect(screen.getByText('Body text')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
