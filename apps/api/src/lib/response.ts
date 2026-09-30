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

export const sendPaginated = (
  res: Response,
  items: unknown[],
  pagination: PaginationMeta,
): void => {
  res.status(200).json({ success: true, data: items, meta: { pagination } });
};
