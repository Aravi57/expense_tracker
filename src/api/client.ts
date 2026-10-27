import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Any data change can affect balances, totals and charts, so refresh every
// query; only the ones currently on screen actually refetch.
export function refreshAll() {
  return queryClient.invalidateQueries();
}

// A mutation that refreshes data afterwards and reports failures as a toast.
// Forms call `if (await m.run(args)) onClose()`: run() resolves to false on
// failure instead of throwing, since the toast has already told the user.
export function useDataMutation<TArgs, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((result: TResult, args: TArgs) => string | undefined) } = {},
) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      const msg = typeof opts.success === 'function' ? opts.success(result, args) : opts.success;
      if (msg) toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message || 'Something went wrong'),
    onSettled: () => qc.invalidateQueries(),
  });
  const run = async (args: TArgs) => {
    try {
      await mutation.mutateAsync(args);
      return true;
    } catch {
      return false;
    }
  };
  return { ...mutation, run };
}
