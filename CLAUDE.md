# Instrucciones del Proyecto: Consistencia y Calidad

Como asistente de este repositorio, debes adherirte a las siguientes reglas de operación en cada tarea:

## 1. Vigilancia de Consistencia
- Antes de realizar cambios, analiza la estructura existente para asegurar que el nuevo código respeta los patrones de diseño y nomenclatura actuales.
- Garantiza la integridad referencial: si cambias una definición (ej. en una Ruta), verifica todos los Eventos o servicios que dependan de ella.

## 2. Protocolo de Errores y Registro
- **Ciclo de Aprendizaje:** Cada vez que un comando de test, linter o compilación falle tras un cambio tuyo, documenta internamente la causa raíz.
- **Prevención de Regresiones:** Una vez corregido un fallo, aplica esa misma lógica de corrección a cualquier otra parte del código que presente el mismo patrón para evitar que el error se repita.
- **Validación Obligatoria:** No des por finalizada una tarea sin ejecutar las pruebas pertinentes que aseguren la funcionalidad completa del cambio.

## 3. Calidad del Código
- Prioriza la legibilidad y el manejo de excepciones.
- Si encuentras código redundante o inconsistente mientras trabajas en una tarea, propón una refactorización breve para mantener la salud del proyecto.

---

# Guía de Arquitectura y Estructura del Proyecto

## Descripción General

**Nombre:** Club Nexus (CodeName: VeloManager)
**Tipo:** Plataforma SaaS multi-tenant para gestión de clubs deportivos
**Stack:** Next.js 14 + TypeScript + PostgreSQL + Prisma ORM
**Hosting:** Vercel (con Cron Jobs configurados)

---

## Estructura de Directorios

```
/
├── src/
│   ├── app/                         # Next.js 14 App Router
│   │   ├── (auth)/                  # Rutas públicas de autenticación
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── reset-password/
│   │   ├── (dashboard)/             # Rutas protegidas (requieren sesión)
│   │   │   ├── admin/               # Panel de administrador del club
│   │   │   ├── socio/               # Portal del socio/miembro
│   │   │   ├── superadmin/          # Panel de administración de plataforma
│   │   │   └── notifications/       # Centro de notificaciones
│   │   ├── api/                     # Endpoints REST (server-side)
│   │   │   ├── auth/                # NextAuth + registro + password reset
│   │   │   ├── clubs/[clubId]/      # Todas las ops del club
│   │   │   ├── cron/                # Jobs programados (Vercel Cron)
│   │   │   ├── superadmin/          # Ops de plataforma (SUPER_ADMIN only)
│   │   │   ├── notifications/       # Notificaciones del usuario
│   │   │   ├── tickets/             # Soporte/tickets
│   │   │   ├── ads/                 # Servidor de anuncios
│   │   │   └── banners/             # Banners de plataforma
│   │   ├── clubs/                   # Páginas de club para visitantes
│   │   ├── events/[token]/          # Vista pública de evento (sin auth)
│   │   ├── invite/[token]/          # Flujo de aceptación de invitación
│   │   └── page.tsx                 # Landing page
│   ├── components/
│   │   ├── ui/                      # Componentes UI primitivos reutilizables
│   │   ├── layout/                  # Header, Sidebar, ClubSwitcher
│   │   ├── providers/               # SessionProvider, SWRConfigProvider
│   │   ├── notifications/           # NotificationBell
│   │   ├── announcements/           # EmergencyAnnouncementModal
│   │   └── ads/                     # AdSlot
│   ├── hooks/                       # Custom React hooks
│   ├── lib/                         # Lógica de negocio y utilidades
│   │   ├── prisma.ts                # Singleton del cliente Prisma
│   │   ├── auth.ts                  # Configuración de NextAuth
│   │   ├── authz.ts                 # Helpers de autorización (RBAC)
│   │   ├── permissions.ts           # Matriz de permisos (ClubRole → Actions)
│   │   ├── modules.ts               # Control de acceso por plan de suscripción
│   │   ├── notification-service.ts  # Despacho de notificaciones
│   │   ├── ledger.ts                # Helpers de contabilidad
│   │   ├── audit.ts                 # Registro de auditoría
│   │   ├── push.ts                  # Notificaciones push (Firebase FCM)
│   │   ├── themes.ts                # Presets de temas de color
│   │   ├── utils.ts                 # Utilidades: fechas, moneda, paginación, API
│   │   └── email/                   # Plantillas y envío de correos
│   ├── providers/                   # Providers globales de la app
│   ├── middleware.ts                # Middleware de Next.js (auth + routing)
│   └── types/                       # Definiciones de tipos TypeScript
├── prisma/
│   ├── schema.prisma                # Esquema de la BD (~1300 líneas)
│   ├── migrations/                  # Historial de migraciones
│   └── seed.ts                      # Script de seeding inicial
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                      # Configuración de Cron Jobs
└── .env.example                     # Plantilla de variables de entorno
```

---

## Stack Tecnológico

### Frontend
| Tecnología | Uso |
|---|---|
| Next.js 14.2.5 (App Router) | Framework principal, SSR/SSG |
| React 18 + TypeScript | UI y tipado estático |
| Tailwind CSS 3.4 | Estilos con sistema de temas personalizable |
| SWR | Fetching de datos con caché en cliente |
| React Hook Form + Zod | Formularios con validación |
| Zustand | Estado global del cliente |
| Recharts | Gráficos y visualización de datos |
| Lucide React | Iconografía |
| React Hot Toast | Notificaciones de UI |
| React Dropzone | Subida de archivos |
| xlsx | Exportación a Excel |

### Backend
| Tecnología | Uso |
|---|---|
| Next.js API Routes | Endpoints REST server-side |
| NextAuth 4.24.7 | Autenticación (Credentials + Google + GitHub) |
| Prisma ORM 5.16.0 | Acceso a la BD type-safe |
| PostgreSQL | Base de datos relacional |
| bcryptjs | Hash de contraseñas |
| Zod | Validación de inputs en APIs |

### Servicios Externos
| Servicio | Variable de entorno | Uso |
|---|---|---|
| Firebase (FCM) | `FIREBASE_*` | Notificaciones push |
| Resend | `RESEND_API_KEY` | Envío de correos (prod) |
| Cloudinary | `CLOUDINARY_*` | Subida de imágenes (opcional) |
| Vercel Cron | `CRON_SECRET` | Jobs programados |

---

## Arquitectura Multi-Tenant

Toda la plataforma está diseñada para soportar múltiples clubs de forma aislada:

- **Aislamiento por fila:** Cada tabla con datos de club incluye `clubId` (indexado)
- **Nunca mezclar datos entre clubs:** Toda query a la BD debe filtrar por `clubId`
- **El middleware verifica sesión** antes de llegar a cualquier ruta de dashboard

---

## Autorización (RBAC)

### Roles de Plataforma (`PlatformRole`)
- `SUPER_ADMIN`: Acceso total a la plataforma (gestiona clubs, planes, módulos)
- `USER`: Usuario normal, accede solo a sus clubs

### Roles de Club (`ClubRole`)
- `ADMIN`: Gestión completa del club
- `MEMBER`: Acceso de socio (leer, asistir, votar, pedir, crear tickets)

### Funciones de autorización en `src/lib/authz.ts`

```typescript
// Verificar sesión activa
const { userId, platformRole } = await requireAuth(request);

// Verificar membresía + rol mínimo en un club
const { userId, clubId, clubRole, membershipId } = await requireClubAccess(
  request,
  clubId,
  'ADMIN' // rol mínimo requerido
);

// Solo SUPER_ADMIN
const { userId } = await requireSuperAdmin(request);
```

**Regla crítica:** Los SUPER_ADMIN bypass las verificaciones de membresía y se tratan como ADMIN en cualquier club.

**Nunca confiar en el JWT para roles:** Siempre consultar la BD para verificar el rol actual.

### Matriz de Permisos (`src/lib/permissions.ts`)
- `can(role, action)` — verifica si un rol puede realizar una acción (solo para UI)
- Las APIs siempre validan permisos independientemente del cliente

---

## Patrones de API

### Estructura de URL
```
/api/clubs/[clubId]/[recurso]/[id]/[acción]
```

### Formato de respuesta estándar
```typescript
// Éxito
{ ok: true, data: {...} }
{ ok: true, data: [...], page, pageSize, totalPages, total }

// Error
{ ok: false, error: "Mensaje descriptivo" }
```

Usar siempre los helpers de `src/lib/utils.ts`:
```typescript
import { ok, err } from '@/lib/utils';

return ok({ ... });           // NextResponse con { ok: true, data: ... }
return err('Mensaje', 400);   // NextResponse con { ok: false, error: ... }
```

### Validación de inputs
Siempre usar Zod para validar el body de los requests:
```typescript
const schema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
});
const body = schema.parse(await req.json());
```

### Paginación
```typescript
import { getPaginationParams, buildPaginatedResponse } from '@/lib/utils';

const { page, pageSize, skip } = getPaginationParams(req);
const [items, total] = await Promise.all([
  prisma.model.findMany({ skip, take: pageSize }),
  prisma.model.count(),
]);
return ok(buildPaginatedResponse(items, total, page, pageSize));
```

---

## Patrones de Base de Datos

### Reglas del Ledger Contable (`BankMovement`)
- El ledger es **append-only**: no se borran movimientos, se revierten con otro movimiento
- **Idempotencia:** Cada movimiento tiene `source` + `sourceId` únicos para evitar duplicados
- Los pagos de eventos y órdenes se auto-registran en el ledger

### Transacciones Prisma
Para operaciones que afectan múltiples tablas usar `prisma.$transaction`:
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({ ... });
  await tx.bankMovement.create({ ... });
});
```

### Auditoría
Registrar toda acción crítica con `src/lib/audit.ts`:
```typescript
import { logAudit } from '@/lib/audit';
await logAudit({
  userId,
  clubId,
  action: 'MEMBER_BANNED',
  entity: 'ClubMembership',
  entityId: membershipId,
  details: { reason },
  ip: req.headers.get('x-forwarded-for') ?? undefined,
});
```

---

## Modelos Principales de la BD

| Modelo | Descripción |
|---|---|
| `User` | Usuario de la plataforma (email, password, platformRole) |
| `Club` | Entidad tenant principal |
| `ClubMembership` | Relación User ↔ Club con rol y estado |
| `ClubEvent` | Eventos del club con RSVP y pagos |
| `Vote` | Sistema de votaciones/polls |
| `Order` / `PurchaseWindow` | Sistema de pedidos/compras |
| `BankMovement` | Ledger contable append-only |
| `Notification` | Notificaciones in-app del usuario |
| `Ticket` | Sistema de soporte |
| `AuditLog` | Registro inmutable de acciones |
| `ClubSubscription` | Plan de suscripción del club |

---

## Módulos y Planes de Suscripción

Los módulos se habilitan según el plan (`FREE`, `PRO`, `PREMIUM`, `ENTERPRISE`):

| Módulo | FREE | PRO | PREMIUM | ENTERPRISE |
|---|---|---|---|---|
| members | ✓ | ✓ | ✓ | ✓ |
| events | ✓ | ✓ | ✓ | ✓ |
| accounting | - | ✓ | ✓ | ✓ |
| purchases | - | ✓ | ✓ | ✓ |
| votes | - | ✓ | ✓ | ✓ |
| messaging | - | - | ✓ | ✓ |
| tickets | - | ✓ | ✓ | ✓ |

Verificar acceso a módulos con `src/lib/modules.ts`:
```typescript
import { hasModuleAccess } from '@/lib/modules';
const hasAccess = await hasModuleAccess(clubId, 'accounting');
```

Los SUPER_ADMIN pueden conceder acceso a módulos fuera del plan en `ClubModuleAccess`.

---

## Sistema de Notificaciones

El servicio en `src/lib/notification-service.ts` maneja tres canales:
- **In-app:** Almacenadas en `Notification` table
- **Push:** Firebase FCM via `src/lib/push.ts`
- **Email:** Console (dev) o Resend (prod) via `src/lib/email/`

Respetar siempre las preferencias del usuario (`NotificationPreference`).

---

## Convenciones de Código

### Idioma
- **UI/Labels/Mensajes al usuario:** Español
- **Código/Variables/Comentarios:** Inglés (nombres en inglés)
- **Fechas:** Formato `dd/MM/yyyy` con locale `es-ES`
- **Moneda:** EUR con locale `es-ES`

### Formateo con utilidades de `src/lib/utils.ts`
```typescript
fmtDate(date)           // "15/03/2024"
fmtDateTime(date)       // "15/03/2024, 14:30"
fmtRelative(date)       // "hace 2 horas"
fmtCurrency(amount)     // "125,00 €"
slugify(text)           // "mi-texto-aqui"
cn(...classes)          // Tailwind class merge
```

### Alias de importación
Usar siempre `@/` en lugar de rutas relativas largas:
```typescript
import { prisma } from '@/lib/prisma';
import { requireClubAccess } from '@/lib/authz';
```

### Componentes UI
Los componentes primitivos están en `src/components/ui/`. Usar siempre los existentes antes de crear nuevos:
- `Card`, `Input`, `Button`, `Modal`, `Badge`, `Pagination`, `Skeleton`, `StatCard`

### Sistema de Temas
Los colores del club se aplican mediante CSS custom properties:
```css
--color-primary: /* rgb values */
--color-primary-dark:
--color-primary-light:
--color-secondary:
--color-accent:
```

8 presets disponibles en `src/lib/themes.ts`: `blue`, `orange`, `green`, `red`, `purple`, `yellow`, `teal`, `slate`.

---

## Scripts de Desarrollo

```bash
npm run dev              # Servidor local en :3000
npm run build            # Build de producción (genera Prisma + push schema + build Next)
npm run lint             # Linter ESLint

# Base de datos
npm run db:generate      # Regenerar cliente Prisma tras cambios en schema
npm run db:push          # Sincronizar schema con la BD (dev, sin migración)
npm run db:migrate       # Crear y aplicar migración (producción)
npm run db:seed          # Poblar BD con datos iniciales
```

---

## Variables de Entorno

Ver `.env.example` para la lista completa. Variables mínimas para desarrollo local:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="minimo-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"
EMAIL_PROVIDER="console"         # Usa console.log en lugar de enviar emails
```

---

## Jobs Programados (Cron)

Configurados en `vercel.json`. Requieren el header `x-cron-secret: $CRON_SECRET`:

| Endpoint | Horario | Función |
|---|---|---|
| `/api/cron/event-reminders` | 8:00 diario | Recordatorios de eventos (24h y 2h antes) |
| `/api/cron/payment-reminders` | 9:00 diario | Avisos de pagos vencidos |
| `/api/cron/weekly-digest` | 8:00 lunes | Resumen semanal por email |
| `/api/cron/process-queue` | 7:00 diario | Procesador de cola de jobs (`NotificationJob`) |

---

## Tests y Validación

Actualmente no hay suite de tests automatizados. La validación obligatoria es:

1. **Antes de hacer commit:** `npm run lint` no debe arrojar errores
2. **Después de cambios en schema:** `npm run db:generate` para regenerar el cliente
3. **Para cambios en APIs:** Verificar manualmente el endpoint con curl o Postman
4. **Para cambios en UI:** Verificar en el navegador con `npm run dev`

---

## Reglas Críticas para AI Assistants

1. **Nunca mezclar datos entre clubs:** Todo query de BD debe incluir `where: { clubId }`.
2. **Siempre usar `requireClubAccess` o `requireAuth`** en route handlers — nunca confiar en parámetros del URL para autorización.
3. **El ledger es sagrado:** Nunca borrar `BankMovement`. Si hay error, crear un movimiento de reversión.
4. **Validar con Zod** siempre antes de procesar datos del request body.
5. **Registrar con `logAudit`** toda acción administrativa crítica.
6. **Verificar módulos** con `hasModuleAccess` antes de exponer funcionalidades de pago.
7. **No exponer datos sensibles** (passwords, tokens) en respuestas de API.
8. **Usar transacciones** cuando una operación afecte múltiples tablas relacionadas.
9. **Respetar preferencias de notificación** del usuario antes de enviar push/email.
10. **Después de modificar `prisma/schema.prisma`:** ejecutar `npm run db:generate`.
