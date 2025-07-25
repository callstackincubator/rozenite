// Utility functions for formatting and styling

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString();
};

export const formatDuration = (duration: number): string => {
  if (duration < 1000) return `${Math.round(duration)}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
};

export const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return '#4caf50';
  if (status >= 300 && status < 400) return '#ff9800';
  if (status >= 400 && status < 500) return '#f44336';
  if (status >= 500) return '#9c27b0';
  return '#757575';
};

export const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#61affe';
    case 'POST':
      return '#49cc90';
    case 'PUT':
      return '#fca130';
    case 'DELETE':
      return '#f93e3e';
    case 'PATCH':
      return '#50e3c2';
    default:
      return '#757575';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const parseUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    return {
      domain: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      protocol: urlObj.protocol,
    };
  } catch {
    return {
      domain: 'Invalid URL',
      path: url,
      protocol: 'unknown',
    };
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatLongUrl = (url: string, maxLength = 80): string => {
  if (url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    // Keep protocol and hostname, truncate path if needed
    const baseLength = protocol.length + hostname.length + 3; // +3 for "://"
    const remainingLength = maxLength - baseLength - 3; // -3 for "..."

    if (remainingLength <= 0) {
      return `${protocol}//${hostname}...`;
    }

    const fullPath = pathname + search;
    if (fullPath.length <= remainingLength) {
      return url;
    }

    return `${protocol}//${hostname}${fullPath.substring(
      0,
      remainingLength
    )}...`;
  } catch {
    return truncateText(url, maxLength);
  }
};
