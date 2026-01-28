// src/common/zod/contract.schema.ts

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../openapi/registry';
import { ID, ISODateTimeString } from './domain.schema';

// Extend Zod con OpenAPI helpers
extendZodWithOpenApi(z);

/**
 * CONTRACT
 *
 * - Representa un contrato de alquiler (legal, no operativo).
 * - Define derechos/obligaciones básicas y vigencia, NO ejecución ni pagos.
 * - Contract ≠ Payment: no hay dinero, cuentas corrientes ni montos.
 * - Contract ≠ Signature: no hay firma digital ni electrónica modelada.
 *
 * Relación con Tenancy:
 * - Tenancy es "contract-aware but not contract-bound" (ocupación puede existir sin contrato).
 * - Contract puede existir sin Tenancy activa (ej. contrato firmado antes de ocupación).
 * - DECISIÓN PENDIENTE: ¿Contract → Tenancy es 1-1 o 1-N?
 *   * 1-1: Un contrato cubre exactamente una tenancy (más simple, más restrictivo).
 *   * 1-N: Un contrato puede cubrir múltiples tenancies (renovaciones, prórrogas).
 *   → Por ahora: contractId en Contract es opcional, se relaciona vía tenancyId.
 *   → Si elegís 1-N, agregá un array de tenancyIds o una tabla intermedia.
 */

export const ContractStatusEnum = z.enum([
  'DRAFT',      // borrador, no vinculante
  'ACTIVE',     // vigente, vinculante
  'TERMINATED', // terminado (por vencimiento, rescisión, etc.)
]);

export const ContractInternalSchema = z.object({
  id: ID,
  
  // Relación con Property (1-1: cada contrato es para una propiedad específica)
  propertyId: ID,
  
  // Relación con Tenancy (opcional: puede haber contrato sin tenancy activa)
  // DECISIÓN: Si elegís 1-N, cambiá esto a `tenancyIds: ID[]` o modelá tabla intermedia.
  tenancyId: ID.nullable(),
  
  // Versionado: referencia al contrato anterior (si es renovación/reemplazo)
  // null si es el primer contrato de la serie
  previousContractId: ID.nullable(),
  
  // Vigencia legal
  effectiveFrom: ISODateTimeString, // fecha de inicio de vigencia (puede ser futura)
  effectiveUntil: ISODateTimeString.nullable(), // null si es indefinido o hasta rescisión
  
  // Rescisión (si aplica)
  terminatedAt: ISODateTimeString.nullable(), // fecha de rescisión efectiva
  terminationReason: z.string().max(500).nullable(), // motivo de rescisión (auditoría)
  
  // Estado del contrato
  status: ContractStatusEnum,
  
  // Derechos/obligaciones básicas (texto libre por ahora, sin estructura legal compleja)
  // TODO: cuando necesites cláusulas estructuradas, modelá un array de Clause con tipos.
  terms: z.string().min(1).max(10000), // texto del contrato o referencia a documento
  
  // Partes del contrato (quién alquila y quién arrienda)
  // Por ahora solo IDs; en el futuro podrías necesitar roles legales más complejos.
  lessorId: ID, // arrendador (típicamente PropertyOwner o PropertyManager)
  lesseeId: ID, // arrendatario (típicamente Tenant)
  
  // Auditoría explícita
  createdAt: ISODateTimeString,
  updatedAt: ISODateTimeString,
  createdByUserId: ID,
  
  // TODO: campos explícitamente NO incluidos todavía:
  // - Firma digital/electrónica (signatures, signers, signedAt, etc.)
  // - Pagos (amounts, paymentSchedule, etc.)
  // - Cláusulas estructuradas (penalizaciones, garantías, etc.)
  // - Jurisdicción específica (country, state, legalFramework)
  // - Documentos adjuntos (attachments, documentIds)
}).superRefine((data, ctx) => {
  // Invariante: effectiveUntil debe ser posterior a effectiveFrom (si ambos existen)
  if (data.effectiveUntil && data.effectiveUntil <= data.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveUntil'],
      message: 'La fecha de fin de vigencia debe ser posterior a la fecha de inicio.',
    });
  }
  
  // Invariante: terminatedAt debe ser posterior a effectiveFrom (si existe)
  if (data.terminatedAt && data.terminatedAt < data.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminatedAt'],
      message: 'La fecha de rescisión no puede ser anterior a la fecha de inicio de vigencia.',
    });
  }
  
  // Invariante: si está TERMINATED, debe tener terminatedAt
  if (data.status === 'TERMINATED' && !data.terminatedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'Un contrato TERMINATED debe tener una fecha de rescisión (terminatedAt).',
    });
  }
  
  // Invariante: si está ACTIVE, no debe tener terminatedAt (o debe ser null)
  if (data.status === 'ACTIVE' && data.terminatedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'Un contrato ACTIVE no puede tener fecha de rescisión (terminatedAt).',
    });
  }
});

export const ContractPublicSchema = ContractInternalSchema.omit({
  createdByUserId: true,
  // terms podría ser sensible; decidí si lo exponés públicamente o no.
  // Por ahora lo dejo visible, pero podés hacer .omit({ terms: true }) si hace falta.
});

export const ContractCreateSchema = z
  .object({
    propertyId: ID,
    tenancyId: ID.nullable().optional(),
    previousContractId: ID.nullable().optional(),
    effectiveFrom: ISODateTimeString,
    effectiveUntil: ISODateTimeString.nullable().optional(),
    terms: z.string().min(1).max(10000),
    lessorId: ID,
    lesseeId: ID,
    initialStatus: ContractStatusEnum.default('DRAFT'),
  })
  .superRefine((data, ctx) => {
    // No se puede crear directamente en TERMINATED
    if (data.initialStatus === 'TERMINATED') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['initialStatus'],
        message: 'Un contrato no puede crearse directamente en estado TERMINATED.',
      });
    }
    
    // effectiveUntil debe ser posterior a effectiveFrom
    if (data.effectiveUntil && data.effectiveUntil <= data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveUntil'],
        message: 'La fecha de fin de vigencia debe ser posterior a la fecha de inicio.',
      });
    }
    
    // TODO: validar que lessorId y lesseeId sean diferentes (no puede alquilarse a sí mismo).
    // Esto requiere conocer el dominio de User/LegalEntity; por ahora lo dejo como TODO.
  });

export const ContractUpdateSchema = z
  .object({
    tenancyId: ID.nullable().optional(),
    effectiveFrom: ISODateTimeString.optional(),
    effectiveUntil: ISODateTimeString.nullable().optional(),
    terms: z.string().min(1).max(10000).optional(),
    lessorId: ID.optional(),
    lesseeId: ID.optional(),
    status: ContractStatusEnum.optional(),
    // Rescisión: campos para terminar el contrato
    terminatedAt: ISODateTimeString.nullable().optional(),
    terminationReason: z.string().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // TODO: validar transiciones de estado (DRAFT → ACTIVE, ACTIVE → TERMINATED, etc.).
    // Esto requiere conocer el estado actual en DB, así que debe vivir en el caso de uso.
    
    // Si se está terminando, debe tener terminatedAt
    if (data.status === 'TERMINATED' && !data.terminatedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['terminatedAt'],
        message: 'Para terminar un contrato, debe proporcionarse terminatedAt.',
      });
    }
    
    // effectiveUntil debe ser posterior a effectiveFrom (si ambos se actualizan)
    // Nota: esto es parcial; la validación completa requiere el estado actual.
    // TODO: validar en caso de uso combinando estado actual + payload.
  });

registry.register('Contract', ContractPublicSchema);