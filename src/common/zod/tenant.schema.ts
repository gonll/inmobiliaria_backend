import { z } from 'zod';
import { extendZodWithOpenApi } from 'zod-to-openapi';
import { registry } from '../openapi/registry';

extendZodWithOpenApi(z);

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

registry.register('Tenant', TenantSchema);

export type Tenant = z.infer<typeof TenantSchema>;

