# Plataforma LegalTech Inmobiliaria – Backend (estado actual)

Este repo define el **núcleo de dominio y contratos** de una plataforma LegalTech inmobiliaria orientada a **locadores profesionales**, con foco en prevención de conflictos, auditoría y escalabilidad legal. No gestiona “propiedades” como un PMS clásico: gestiona **riesgo legal y operativo**.

## Stack base

- **Node.js + TypeScript**
- **NestJS** como marco estructural (límites claros, DI, módulos)
- **PostgreSQL** como base de datos principal
- **Prisma** para schema tipado y migraciones auditables
- **Zod** como frontera de validación y definición de reglas de negocio
- **zod-to-openapi** para generar OpenAPI desde los mismos schemas
- **Kubb** para generar SDKs y tipos tipados desde OpenAPI
- **Redis + BullMQ** (planeado) para jobs diferidos (cobros, notificaciones, legales)
- **Storage S3-compatible** para documentación con hashing
- **Auth externo (ej. Auth0 / Google OAuth)** – aún no modelado en detalle

El principio rector es **una sola fuente de verdad**:
Zod → OpenAPI → SDKs → Prisma  
Sin duplicar modelos ni contratos.

## Pipeline mental de desarrollo

1. **Definir reglas de negocio en Zod** (no tablas, no SQL).
2. Generar **OpenAPI** desde Zod.
3. Generar **SDKs y tipos** con Kubb.
4. Ajustar **Prisma schema y migraciones** en base a invariantes ya decididos.
5. Implementar casos de uso (servicios Nest).

Zod no es “validar inputs”: es **diseño de dominio explícito**.

## Dominio definido hasta ahora

### User
- Usuario de la plataforma.
- Autenticación delegada (Google OAuth).
- Rol global mínimo (roles contextuales viven en relaciones).
- Auditoría completa (`createdAt`, `updatedAt`, `createdByUserId`).

### Property
- Inmueble.
- Identificado por `UUID` interno.
- **Regla clave**: una propiedad debe tener **o padrón válido o geocode confirmado**.
- Estado simple (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- El creador es el `owner` inicial (no hay disputas por ahora).

### Address (decisión tomada)
- La dirección **no es texto libre**.
- Se modela con soporte de geocoding:
  - `lat`, `lng`
  - `osmId` (OpenStreetMap)
  - `address_components`
- El string visible es derivado, no fuente de verdad.
- Se planea usar OpenStreetMap + MapLibre + Nominatim/Pelias.

### PropertyOwnership
- Relación de **control/gestión**, no de uso.
- Roles permitidos: `OWNER`, `MANAGER`.
- Soporta múltiples owners.
- Porcentajes operativos (no prueba legal).
- Invariantes:
  - No duplicados por `(propertyId, ownerId, role)`.
  - Suma de porcentajes `OWNER <= 100`.
- Todo auditado.

### Tenancy / Participation (decisión tomada)
- **TENANT no es ownership**.
- Se modela como entidad separada (inquilinato/participación).
- Base para contratos, cuentas corrientes y conflictos futuros.

### Invitation
- Invitaciones para participar en una propiedad.
- **No expiran automáticamente** (decisión de negocio actual).
- Estados: `PENDING`, `ACCEPTED`, `REVOKED`.
- Todo cambio es auditado.
- No se invita con roles globales peligrosos (ej. ADMIN).

## Decisiones importantes (y por qué)

- **Dirección por mapa**: reduce duplicados, disputas y errores humanos.
- **Separación ownership / tenancy**: evita romper contratos y finanzas más adelante.
- **Auditoría explícita en todo**: esto es LegalTech, no una app social.
- **Enums simples + TODO claros**: sin sobre-ingeniería legal prematura.
- **Nada “mágico”**: estados y transiciones explícitas.

## Qué NO está hecho todavía

- Contratos (legal + versionado).
- Cuenta corriente / cobros / mora.
- Firma digital.
- Motor de IA para mediación (solo conceptual).
- Máquinas de estado formales.
- Import masivo (Excel).
- Sistema de disputas de propiedad.

Todo eso se construye **después** de cerrar bien Property + Ownership + Tenancy.

## Regla de oro del proyecto

> Si una regla no está escrita en Zod, **no existe**.

Este README refleja el estado actual del dominio y el enfoque de diseño.  
Antes de escribir SQL o endpoints, se discuten y fijan **reglas de negocio**.
