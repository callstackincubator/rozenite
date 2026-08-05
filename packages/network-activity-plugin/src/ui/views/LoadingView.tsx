import { Loader2 } from 'lucide-react';

export const LoadingView = () => {
  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            Loading Network Inspector
          </h2>
          <p className="text-gray-400 text-sm">
            Initializing network monitoring...
          </p>
        </div>
      </div>
    </div>
  );
};
