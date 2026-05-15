export const downloadFile = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadJsonFile = (fileName: string, data: unknown) => {
  downloadFile(
    fileName,
    new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    }),
  );
};
