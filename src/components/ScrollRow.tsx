import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// A horizontally scrolling row with ‹ › buttons that appear only when there is
// more to see in that direction (a mouse can't swipe like a touch screen can).
export function ScrollRow({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [update]);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  const arrow = 'absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full surface shadow-md transition hover:scale-105';

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} role="region" aria-label={label} tabIndex={0}
        className={clsx('no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth', className)}>
        {children}
      </div>
      {canLeft && (
        <button type="button" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)} className={clsx(arrow, '-left-2 sm:-left-4')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canRight && (
        <button type="button" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)} className={clsx(arrow, '-right-2 sm:-right-4')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
