const idMap = new Map<string, number>();

export const getId = (namespace: string) => {
  if (!idMap.has(namespace)) {
    idMap.set(namespace, 0);
  }
  const id = idMap.get(namespace) ?? 0;
  idMap.set(namespace, id + 1);
  return `${namespace}-${id}`;
};
