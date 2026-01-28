import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

export const registry = new OpenAPIRegistry();

export function generateOpenApiDocument(): unknown {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Inmobiliaria Digital API',
      version: '0.1.0',
    },
  });
}

