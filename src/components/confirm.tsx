import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button, Sheet } from './ui';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// In-app replacement for window.confirm(): `if (await confirm({...})) ...`
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const finish = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={!!state}
        onClose={() => finish(false)}
        title={state?.title ?? ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => finish(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => finish(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-muted">{state?.message}</div>
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
