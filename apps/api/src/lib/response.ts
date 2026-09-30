import type { PaginationMeta } from '@edumetrics/shared';
import type { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  meta?: Record<string, unknown>,
  status = 200,
): void => {
  res
    .status(status)
    .json(meta === undefined ? { success: true, data } : { success: true, data, meta });
};

/** 201 Created with the standard envelope. */
export const sendCreated = (res: Response, data: unknown): void => {
  sendSuccess(res, data, undefined, 201);
};

export const sendPaginated = (
  res: Response,
  items: unknown[],
  pagination: PaginationMeta,
): void => {
  res.status(200).json({ success: true, data: items, meta: { pagination } });
};
