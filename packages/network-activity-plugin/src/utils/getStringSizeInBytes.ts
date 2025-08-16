export const getStringSizeInBytes = (value: string) => {
  return new TextEncoder().encode(value).length;
};
