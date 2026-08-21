import { QueryClient } from '@tanstack/react-query';

// Shared between App.tsx (QueryClientProvider) and rozenite.dev's dev entry
// (useTanStackQueryDevTools), which is why it lives at module scope in its
// own file rather than inside either of them.
export const queryClient = new QueryClient();
