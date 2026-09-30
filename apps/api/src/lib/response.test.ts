import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { sendPaginated, sendSuccess } from './response.js';

const fakeRes = () => {
  const json = vi.fn();
  const status = vi.fn();
  const res = { status, json } as unknown as Response;
  status.mockReturnValue(res);
  return { res, status, json };
};

describe('response helpers (CONV-002)', () => {
  it('sendSuccess wraps data in the success envelope', () => {
    const { res, status, json } = fakeRes();
    sendSuccess(res, { id: 1 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
  });

  it('sendSuccess supports meta and a custom status', () => {
    const { res, status, json } = fakeRes();
    sendSuccess(res, { id: 1 }, { extra: true }, 202);
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { id: 1 },
      meta: { extra: true },
    });
  });

  it('sendPaginated puts pagination under meta', () => {
    const { res, status, json } = fakeRes();
    sendPaginated(res, [{ id: 1 }], { nextCursor: 'abc', limit: 20 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1 }],
      meta: { pagination: { nextCursor: 'abc', limit: 20 } },
    });
  });
});
