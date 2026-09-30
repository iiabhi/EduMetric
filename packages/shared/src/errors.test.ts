import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_HTTP_STATUS, errorCodeSchema } from './errors.js';

// CONV-004 catalog, copied from the SRD so drift is caught.
const CATALOG: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  ONBOARDING_REQUIRED: 403,
  EMAIL_NOT_VERIFIED: 403,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_ALREADY_REGISTERED: 409,
  CODING_PROFILE_ALREADY_LINKED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  INVALID_CODING_USERNAME: 422,
  LIMIT_EXCEEDED: 422,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  CODING_PROVIDER_UNAVAILABLE: 503,
  CODING_PLATFORM_DISABLED: 503,
  NEWS_PROVIDER_UNAVAILABLE: 503,
  AI_PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

describe('error code catalog (CONV-004)', () => {
  it('maps every code to the documented HTTP status', () => {
    expect({ ...ERROR_HTTP_STATUS }).toEqual(CATALOG);
  });

  it('exposes exactly the catalog codes', () => {
    expect(Object.values(ERROR_CODES).sort()).toEqual(Object.keys(CATALOG).sort());
  });

  it('validates codes with the zod enum', () => {
    expect(errorCodeSchema.safeParse('RATE_LIMITED').success).toBe(true);
    expect(errorCodeSchema.safeParse('NOPE').success).toBe(false);
  });
});
