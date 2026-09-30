declare global {
  namespace Express {
    interface Request {
      /** Request ID (CONV-009), set by the requestId middleware. */
      id: string;
      /** Zod-parsed body/query/params, set by the validate middleware. */
      validated: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
