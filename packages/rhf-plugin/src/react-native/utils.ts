import get from 'lodash/get';

export function proxyToObject<T extends Record<string, unknown>>(proxy: T): T {
  return Reflect.ownKeys(proxy).reduce((prev, key) => {
    prev[key as keyof T] = proxy[key as keyof T];
    return prev;
  }, {} as T);
}

export function nestToFlat<V>(
  flatKeys: string[],
  obj: object,
  defaultValue?: V
): Record<string, V> {
  return flatKeys.reduce(
    (prev, name) => {
      prev[name] = (get(obj, name) || defaultValue) as V;
      return prev;
    },
    {} as Record<string, V>
  );
}
