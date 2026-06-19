export const LoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-center p-6">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin mb-4" />
      <p className="text-sm text-muted">Loading require profiler data...</p>
    </div>
  );
};
