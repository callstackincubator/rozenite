export const getStatusColor = (status: number | string): string => {
  if (typeof status === 'string') {
    // Handle WebSocket statuses
    if (status === 'open') return 'text-green-400';
    if (status === 'connecting') return 'text-yellow-400';
    if (status === 'closed' || status === 'error') return 'text-red-400';
    return 'text-gray-400';
  }

  // Handle HTTP status codes
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400) return 'text-red-400';
  return 'text-gray-400';
};
