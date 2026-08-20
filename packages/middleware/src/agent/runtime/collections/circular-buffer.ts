/**
 * Fixed-capacity buffer over an append-only sequence.
 *
 * Entries are addressed by a *global* index that starts at 0 and increases
 * forever. The buffer is a sliding window over that index space: once it is
 * full, appending overwrites the oldest entry and the window moves forward.
 *
 * Because indices are dense and monotonic, translating one to a physical slot
 * is arithmetic, so `at` is O(1) no matter how far the window has slid. That
 * makes an index safe to hand out as a durable cursor: it stays valid and
 * unambiguous after the entry it points at has been evicted, at which point
 * `at` simply reports that it is gone.
 */
export class CircularBuffer<T> {
  readonly capacity: number;

  #slots: (T | null)[];
  /** Physical slot holding the oldest live entry. */
  #start = 0;
  /** Global index of the oldest live entry. */
  #first = 0;
  #size = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(
        `CircularBuffer capacity must be a positive integer, received ${capacity}`,
      );
    }

    this.capacity = capacity;
    // Pre-filling keeps the backing store packed. A sparse array built by
    // `new Array(n)` alone makes every read pay a prototype-chain lookup.
    this.#slots = new Array<T | null>(capacity).fill(null);
  }

  /** Number of entries currently held. */
  get size(): number {
    return this.#size;
  }

  /** Global index of the oldest live entry, i.e. how many entries have left the window. */
  get first(): number {
    return this.#first;
  }

  /** Global index the next append will receive. */
  get next(): number {
    return this.#first + this.#size;
  }

  /** Appends a value and returns the global index assigned to it. */
  append(value: T): number {
    const index = this.next;
    this.#slots[(this.#start + this.#size) % this.capacity] = value;

    if (this.#size === this.capacity) {
      // The write above landed on the oldest entry; slide the window past it.
      this.#start = (this.#start + 1) % this.capacity;
      this.#first += 1;
    } else {
      this.#size += 1;
    }

    return index;
  }

  /** Whether `index` currently sits inside the window. */
  has(index: number): boolean {
    return Number.isInteger(index) && index >= this.#first && index < this.next;
  }

  /** Returns the entry at a global index, or `undefined` if it was never written or has been evicted. */
  at(index: number): T | undefined {
    if (!this.has(index)) {
      return undefined;
    }

    return this.#slots[(this.#start + (index - this.#first)) % this.capacity] as T;
  }

  /**
   * Walks live entries from `index` in the given direction, yielding
   * `[index, value]` pairs. The start is clamped into the window, so an index
   * pointing at an evicted entry resumes from the oldest live one. Consumers
   * are expected to stop early once they have what they need.
   */
  *from(index: number, order: 'asc' | 'desc'): IterableIterator<[number, T]> {
    if (this.#size === 0 || !Number.isFinite(index)) {
      return;
    }

    const last = this.next - 1;

    if (order === 'asc') {
      for (let i = Math.max(Math.ceil(index), this.#first); i <= last; i += 1) {
        yield [i, this.at(i) as T];
      }
      return;
    }

    for (let i = Math.min(Math.floor(index), last); i >= this.#first; i -= 1) {
      yield [i, this.at(i) as T];
    }
  }

  /** Drops every entry while keeping the index space monotonic. */
  clear(): void {
    this.#slots.fill(null);
    this.#first = this.next;
    this.#size = 0;
    this.#start = 0;
  }
}
