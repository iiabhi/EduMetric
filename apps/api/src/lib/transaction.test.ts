import { describe, expect, it, vi } from 'vitest';
import { withTransaction, type Tx } from './transaction.js';

const fakeDb = () => {
  const tx = { marker: 'tx' } as unknown as Tx;
  const $transaction = vi.fn((fn: (t: Tx) => Promise<unknown>, _options: unknown) => fn(tx));
  return {
    db: { $transaction } as unknown as Parameters<typeof withTransaction>[0],
    $transaction,
    tx,
  };
};

describe('withTransaction', () => {
  it('passes the transaction client and returns the callback result', async () => {
    const { db, tx } = fakeDb();
    const result = await withTransaction(db, (t) => Promise.resolve(t === tx ? 'ok' : 'wrong'));
    expect(result).toBe('ok');
  });

  it('sets explicit wait and run timeouts', async () => {
    const { db, $transaction } = fakeDb();
    await withTransaction(db, () => Promise.resolve(1));
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5000,
      timeout: 10000,
    });
  });

  it('propagates errors from the callback', async () => {
    const { db } = fakeDb();
    await expect(withTransaction(db, () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
  });
});
