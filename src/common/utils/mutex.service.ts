import { Injectable } from '@nestjs/common';

/**
 * Service to handle serialization of operations per key.
 * Used to prevent race conditions during "read-modify-write" cycles on balances.
 *
 * Note: This implementation is in-memory and suitable for single-instance SQLite.
 * For distributed systems, this would be replaced with a Redis-backed lock.
 */
@Injectable()
export class MutexService {
  private readonly locks = new Map<string, Promise<void>>();

  /**
   * Acquires a lock for a specific key.
   * If the key is already locked, waits for it to be released.
   */
  async acquire(key: string): Promise<() => void> {
    const previous = this.locks.get(key) || Promise.resolve();

    let resolve: () => void;
    const current = new Promise<void>((r) => {
      resolve = r;
    });

    this.locks.set(
      key,
      previous.then(() => current),
    );

    await previous;

    return () => {
      resolve();
      // Cleanup map if no other waiters are pending for this key
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    };
  }
}
