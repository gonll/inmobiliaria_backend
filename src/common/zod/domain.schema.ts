import { z } from 'zod';
import { extendZodWithOpenApi } from 'zod-to-openapi';
import { registry } from '../openapi/registry';

// Extend Zod with OpenAPI helpers once for this domain module.
extendZodWithOpenApi(z);

/**
 * Utilidades básicas
 */

export const ID = z.string().uuid();
export const ISODateTimeString = z.string().datetime();

/**
 * ADDRESS
 *
 * - Address se modela como entidad propia, no como string libre.
 * - `components` son los datos normalizados que usás para geocoding y comparación.
 * - `geocode` contiene el resultado de geocoding (OpenStreetMap u otro).
 * - El string visible para UI debe derivarse de `components`, no ser fuente de verdad.
 *
 * Regla de negocio aclarada:
 * - “padrón o geocode” es regla de CREACIÓN, no de EXISTENCIA histórica.
 *   → Se aplica fuerte en AddressCreateSchema.
 *   → AddressInternalSchema permite nulos para soportar migraciones / datos legacy.
 */

export const AddressComponentsSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().max(255).nullable().optional(),
  city: z.string().min(1),
  state: z.string().max(255).nullable().optional(),
  country: z.string().length(2),
  postalCode: z.string().max(32).nullable().optional(),
  padron: z.string().max(128).nullable().optional(),
});

export const AddressGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osmId: z.string().min(1),
  source: z.enum(['OSM']).default('OSM'),
  confirmedAt: ISODateTimeString,
});

export const AddressInternalSchema = z.object({
  id: ID,
  components: AddressComponentsSchema,
  geocode: AddressGeocodeSchema.nullable(), // puede ser null en datos legacy
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
});

export const AddressPublicSchema = AddressInternalSchema.omit({
  createdByUserId: true,
});

export const AddressCreateSchema = z
  .object({
    components: AddressComponentsSchema,
    geocode: AddressGeocodeSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPadron = !!data.components.padron;
    const hasGeocode = !!data.geocode;

    if (!hasPadron && !hasGeocode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components', 'padron'],
        message:
          'Debe enviarse un padrón o un geocode confirmado (al menos uno).',
      });
    }
  });

export const AddressUpdateSchema = z.object({
  components: AddressComponentsSchema.partial().optional(),
  geocode: AddressGeocodeSchema.nullable().optional(),
});

registry.register('Address', AddressPublicSchema);

/**
 * PROPERTY
 *
 * - Delega dirección a Address (vía addressId a nivel de dominio/DB).
 * - Mantiene enums simples y deja las transiciones de estado para los casos de uso.
 */

export const PropertyStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const PropertyInternalSchema = z.object({
  id: ID,
  addressId: ID,
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'LAND', 'OTHER']),
  status: PropertyStatusEnum,
  externalRef: z.string().max(255).nullable(),
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
});

export const PropertyPublicSchema = PropertyInternalSchema.omit({
  createdByUserId: true,
});

export const PropertyCreateSchema = z
  .object({
    type: PropertyInternalSchema.shape.type,
    externalRef: z.string().max(255).nullable().optional(),
    address: AddressCreateSchema,
    initialStatus: PropertyStatusEnum.default('DRAFT'),
  })
  .superRefine((data, ctx) => {
    if (data.initialStatus === 'ARCHIVED') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['initialStatus'],
        message: 'Una propiedad no puede crearse directamente en estado ARCHIVED.',
      });
    }
  });

export const PropertyUpdateSchema = z.object({
  type: PropertyInternalSchema.shape.type.optional(),
  externalRef: z.string().max(255).nullable().optional(),
  status: PropertyStatusEnum.optional(),
  address: AddressUpdateSchema.optional(),
});

registry.register('Property', PropertyPublicSchema);

/**
 * OWNERSHIP
 *
 * - Solo para control/gestión (OWNER, MANAGER).
 * - No incluye TENANT; la tenencia se modela en Tenancy.
 * - Rol contextual a la propiedad, no rol global de usuario.
 */

export const OwnershipRoleEnum = z.enum(['OWNER', 'MANAGER']);

export const PropertyOwnershipInternalSchema = z.object({
  id: ID,
  propertyId: ID,
  participantId: ID,
  role: OwnershipRoleEnum,
  percentage: z.number().min(0).max(100).multipleOf(0.01).nullable(),
  isPrimary: z.boolean().default(false),
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
});

export const PropertyOwnershipPublicSchema =
  PropertyOwnershipInternalSchema.omit({
    createdByUserId: true,
  });

export const PropertyOwnershipCreateSchema = z.object({
  propertyId: ID,
  participantId: ID,
  role: OwnershipRoleEnum,
  percentage: z.number().min(0).max(100).multipleOf(0.01).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export const PropertyOwnershipUpdateSchema = z.object({
  role: OwnershipRoleEnum.optional(),
  percentage: z.number().min(0).max(100).multipleOf(0.01).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

registry.register('PropertyOwnership', PropertyOwnershipPublicSchema);

/**
 * TENANCY
 *
 * - Representa participación de TENANT en una propiedad (ocupación).
 * - "Contract-aware but not contract-bound":
 *   * Se asume que suele haber un contrato detrás, pero NO se fuerza ni modela aún.
 *   * No se asume implícitamente que siempre hay contrato firmado.
 */

export const TenancyStatusEnum = z.enum(['ACTIVE', 'ENDED']);

export const TenancyInternalSchema = z.object({
  id: ID,
  propertyId: ID,
  tenantId: ID,
  status: TenancyStatusEnum,
  startsAt: ISODateTimeString,
  endsAt: ISODateTimeString.nullable(),
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
});

export const TenancyPublicSchema = TenancyInternalSchema.omit({
  createdByUserId: true,
});

export const TenancyCreateSchema = z.object({
  propertyId: ID,
  tenantId: ID,
  startsAt: ISODateTimeString,
  endsAt: ISODateTimeString.nullable().optional(),
});

export const TenancyUpdateSchema = z.object({
  status: TenancyStatusEnum.optional(),
  endsAt: ISODateTimeString.nullable().optional(),
});

registry.register('Tenancy', TenancyPublicSchema);

/**
 * INVITATION
 *
 * - Estados: PENDING, ACCEPTED, REVOKED.
 * - No expiran automáticamente; cualquier cambio debe ser una acción explícita
 *   auditada a nivel de caso de uso (logs, eventos, etc.).
 */

export const InvitationStatusEnum = z.enum([
  'PENDING',
  'ACCEPTED',
  'REVOKED',
]);

export const InvitationInternalSchema = z.object({
  id: ID,
  email: z.string().email(),
  invitedUserId: ID.nullable(),
  propertyId: ID.nullable(),
  status: InvitationStatusEnum,
  token: z.string().min(32),
  targetContext: z.enum(['PROPERTY_OWNER', 'PROPERTY_MANAGER', 'TENANT']),
  targetContextId: ID,
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
  acceptedAt: ISODateTimeString.nullable(),
  revokedAt: ISODateTimeString.nullable(),
});

export const InvitationPublicSchema = InvitationInternalSchema.omit({
  token: true,
  createdByUserId: true,
});

export const InvitationCreateSchema = z.object({
  email: z.string().email(),
  propertyId: ID.nullable().optional(),
  targetContext: InvitationInternalSchema.shape.targetContext,
  targetContextId: ID,
});

export const InvitationUpdateSchema = z.object({
  action: z.enum(['ACCEPT', 'REVOKE']),
  reason: z.string().min(3).max(500).optional(),
});

registry.register('Invitation', InvitationPublicSchema);

