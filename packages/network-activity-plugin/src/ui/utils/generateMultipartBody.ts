export const generateMultipartBody = (formData: Record<string, unknown>) => {
  const boundary = 'FormBoundary' + Math.random().toString(36).substr(2, 16);

  const parts: string[] = [];

  Object.entries(formData).forEach(([key, value]) => {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="${key}"`);
    parts.push('');
    parts.push(String(value));
  });

  parts.push(`--${boundary}--`);

  return {
    body: parts.join('\r\n'),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};
