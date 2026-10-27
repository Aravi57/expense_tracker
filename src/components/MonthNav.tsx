import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, isCurrentMonth, monthLabel, shiftMonth } from '../lib/dates';
import { Button } from './ui';

// "‹ October 2026 ›" with an optional "All time" mode (month = null)
export function MonthNav({ month, onChange, allowAll }: {
  month: string | null; onChange: (m: string | null) => void; allowAll?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous month" disabled={!month}
        onClick={() => month && onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <button type="button" className="min-w-36 rounded-lg px-2 py-1 text-center font-semibold hover:bg-[var(--surface-2)]"
        onClick={() => onChange(currentMonth())} title="Jump to this month">
        {month ? monthLabel(month) : 'All time'}
      </button>
      <Button variant="ghost" size="icon" aria-label="Next month" disabled={!month || isCurrentMonth(month)}
        onClick={() => month && onChange(shiftMonth(month, 1))}>
        <ChevronRight className="h-5 w-5" />
      </Button>
      {allowAll && (
        <Button variant={month ? 'ghost' : 'secondary'} size="sm" onClick={() => onChange(month ? null : currentMonth())}>
          {month ? 'All time' : 'By month'}
        </Button>
      )}
    </div>
  );
}
