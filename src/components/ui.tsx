import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';
import {
  cloneElement, isValidElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';

export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        size === 'icon' && 'h-9 w-9',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
        variant === 'secondary' && 'surface hover:bg-[var(--surface-2)]',
        variant === 'ghost' && 'hover:bg-[var(--surface-2)] text-muted hover:text-[var(--text)]',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const fieldClass =
  'w-full rounded-xl border border-app bg-[var(--surface)] px-3 h-11 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-[var(--muted)]';

// A labelled form field. The label is tied to the control by id (not by wrapping it),
// so a dropdown is announced as "Account", not "Account No account HDFC…".
// Pass `htmlFor` when the control is nested inside other markup.
export function Field({ label, hint, error, children, className, htmlFor }: {
  label: string; hint?: string; error?: string; children: ReactNode; className?: string; htmlFor?: string;
}) {
  const autoId = useId();
  const hintId = `${autoId}-hint`;
  const message = error ?? hint;
  let control = children;
  let id = htmlFor;
  if (!htmlFor && isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    id = children.props.id ?? autoId;
    control = cloneElement(children, { id, 'aria-describedby': message ? hintId : undefined });
  }
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {control}
      {message && <span id={hintId} className={clsx('block text-xs', error ? 'text-rose-500' : 'text-muted')}>{message}</span>}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(fieldClass, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(fieldClass, 'appearance-none bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: 'right 12px center' }}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(fieldClass, 'h-auto py-2.5 min-h-20', className)} />;
}

export function Card({ title, action, children, className, padded = true }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={clsx('surface rounded-2xl', padded && 'p-4 sm:p-5', className)}>
      {(title || action) && (
        <header className={clsx('mb-3 flex items-center justify-between gap-2', !padded && 'px-4 pt-4 sm:px-5 sm:pt-5')}>
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Segmented control, e.g. Expense / Income / Transfer
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; activeClass?: string }[]; className?: string;
}) {
  return (
    <div role="radiogroup" className={clsx('surface-2 grid rounded-xl p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('h-9 rounded-lg text-sm font-medium transition',
            value === o.value ? clsx('bg-[var(--surface)] shadow-sm', o.activeClass) : 'text-muted hover:text-[var(--text)]')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Bottom sheet on phones, centred dialog on larger screens. Uses the native
// <dialog> element, which handles focus, Escape and stacking for us.
export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={clsx(
        'm-0 mt-auto w-full max-w-none bg-transparent p-0 text-[var(--text)] sm:m-auto',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
      )}
    >
      {open && (
        <div className="animate-sheet surface flex max-h-[92dvh] flex-col rounded-t-3xl sm:rounded-3xl">
          <header className="flex items-center justify-between gap-2 border-b border-app px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="pb-safe border-t border-app px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="surface-2 mb-3 grid h-14 w-14 place-items-center rounded-2xl text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-[var(--surface-2)]', className)} />;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(value, 100));
  const color = value >= 100 ? 'bg-rose-500' : value >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className={clsx('surface-2 h-2 overflow-hidden rounded-full', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Small "+12%" badge; `goodWhenUp` decides whether a rise is green or red
export function Trend({ value, goodWhenUp = true, suffix = 'vs last month' }: { value: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-muted">No earlier data</span>;
  const up = value >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={clsx('text-xs font-medium', Math.abs(value) < 0.5 ? 'text-muted' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}% {suffix}
    </span>
  );
}
