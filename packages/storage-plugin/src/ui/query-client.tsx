import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

const storageQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      gcTime: 0,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
};

export const createStorageQueryClient = () => new QueryClient(storageQueryClientConfig);

export const StorageQueryClientProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(createStorageQueryClient);

  useEffect(() => () => queryClient.clear(), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
