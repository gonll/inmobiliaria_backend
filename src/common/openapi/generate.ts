import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateOpenApiDocument } from './registry';

// Import all Zod schemas so they are registered in the OpenAPI registry
import '../zod/tenant.schema';
import '../zod/domain.schema';

async function main() {
  const document = generateOpenApiDocument();

  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate OpenAPI document', error);
  process.exit(1);
});

