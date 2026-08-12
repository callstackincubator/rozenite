export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

// Metro loads this package as CJS, so callers can't depend on p-limit
// (ESM-only since v3) without risking `ERR_REQUIRE_ESM` on Node versions
// that don't support requiring ESM. This owns the same bounded-concurrency
// semantics without an external dependency.
export const createLimiter = (concurrency: number): Limiter => {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= concurrency || queue.length === 0) {
      return;
    }
    active++;
    queue.shift()?.();
  };

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
};
