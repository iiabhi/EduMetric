import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi()` to Zod schemas. Zod 4 attaches methods per instance, so every schema module
// must import `z` from here (not from 'zod') to be created after the extension runs.
extendZodWithOpenApi(z);

export { z };
