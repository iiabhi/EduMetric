import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../lib/transaction.js';
import { createHealthRepository } from './health.repository.js';

describe('health repository', () => {
  it('ping runs a query and rejects when the database does', async () => {
    const ok = vi.fn(() => Promise.resolve([{ 1: 1 }]));
    await expect(
      createHealthRepository({ $queryRaw: ok } as unknown as DbClient).ping(),
    ).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledOnce();

    const failing = { $queryRaw: () => Promise.reject(new Error('down')) } as unknown as DbClient;
    await expect(createHealthRepository(failing).ping()).rejects.toThrow('down');
  });
});
