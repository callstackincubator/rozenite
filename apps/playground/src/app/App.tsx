import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HelloWorldScreen } from './screens/HelloWorldScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanstackQueryDevTools } from '@rozenite/tanstack-query-plugin';

const queryClient = new QueryClient();

const Wrapper = () => {
   useTanstackQueryDevTools(queryClient);

   return (
    <HelloWorldScreen />
   )
}

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Wrapper />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

export default App;
