import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';

import { Button, Group, Row } from '../ui.jsx';

const queryClient = new QueryClient();

function Demo() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['lynx-demo'],
    // No network in the playground: a resolved promise is enough to give the
    // panel a query to inspect, refetch, and invalidate.
    queryFn: () => Promise.resolve(`fetched at ${new Date().toISOString()}`),
  });

  return (
    <Group title="TanStack Query">
      <Row label="Status" value={isFetching ? 'fetching' : 'idle'} />
      <Row label="Data" value={data ?? '-'} />
      <Row label="Refetch" last trailing={<Button label="Run" onTap={() => void refetch()} />} />
    </Group>
  );
}

/**
 * Minimal TanStack Query playground: one query the DevTools panel can inspect,
 * refetch, and invalidate.
 */
export function TanStackQueryPlayground() {
  useTanStackQueryDevTools(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Demo />
    </QueryClientProvider>
  );
}
