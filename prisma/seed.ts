/**
 * Seed file — creates demo data for development/testing
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Sports catalog ─────────────────────────────────────────────────────
  await prisma.sport.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Ciclismo', icon: 'Bike', order: 1 },
      { name: 'Running', icon: 'PersonRunning', order: 2 },
      { name: 'Triatlón', icon: 'Activity', order: 3 },
      { name: 'Tenis', icon: 'CircleDot', order: 4 },
      { name: 'Pádel', icon: 'Swords', order: 5 },
      { name: 'Natación', icon: 'Waves', order: 6 },
      { name: 'Fútbol', icon: 'Trophy', order: 7 },
      { name: 'Multideporte', icon: 'Dumbbell', order: 8 },
    ],
  })

  // ── Platform modules ────────────────────────────────────────────────────
  const moduleData = [
    { key: 'members', name: 'Gestión de Socios', description: 'Alta, baja y gestión de miembros del club', icon: 'Users', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'accounting_basic', name: 'Contabilidad básica', description: 'Libro de caja y saldo', icon: 'Wallet', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'accounting', name: 'Contabilidad completa', description: 'Facturas, cuotas, informes financieros', icon: 'BarChart2', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'purchases', name: 'Compras conjuntas', description: 'Campañas de equipación y pedidos', icon: 'ShoppingBag', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'votes', name: 'Votaciones', description: 'Encuestas y votaciones democráticas', icon: 'Vote', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'announcements', name: 'Anuncios y archivos', description: 'Tablón de anuncios y documentos compartidos', icon: 'Bell', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'messaging', name: 'Mensajería interna', description: 'Mensajes de gestor a socios con email', icon: 'Mail', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
    { key: 'events', name: 'Calendario de eventos', description: 'Gestión de entrenamientos, carreras y eventos', icon: 'Calendar', includedInPlans: ['PREMIUM', 'ENTERPRISE'] },
    { key: 'audit', name: 'Auditoría', description: 'Registro inmutable de acciones críticas', icon: 'ClipboardList', includedInPlans: ['PREMIUM', 'ENTERPRISE'] },
    { key: 'reports', name: 'Informes financieros', description: 'Gráficos y análisis de contabilidad', icon: 'BarChart2', includedInPlans: ['PREMIUM', 'ENTERPRISE'] },
    { key: 'custom_roles', name: 'Roles personalizados', description: 'Tesorero, secretario, capitán, etc.', icon: 'ShieldCheck', includedInPlans: ['ENTERPRISE'] },
  ]

  for (const m of moduleData) {
    await prisma.platformModule.upsert({
      where: { key: m.key },
      update: {},
      create: m,
    })
  }

  // ── Super Admin ─────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@clube.app' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@clube.app',
      password: await hash('clube1234', 12),
      role: 'SUPER_ADMIN',
    },
  })
  // Keep legacy email working too
  await prisma.user.upsert({
    where: { email: 'superadmin@nexus.dev' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@nexus.dev',
      password: await hash('clube1234', 12),
      role: 'SUPER_ADMIN',
    },
  })
  console.log(`Super Admin: ${superAdmin.email}`)

  // ── Demo club admin ─────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@velo.cc' },
    update: {},
    create: {
      name: 'Carlos Velo',
      email: 'admin@velo.cc',
      password: await hash('clube1234', 12),
      role: 'CLUB_ADMIN',
    },
  })

  // ── Demo club ────────────────────────────────────────────────────────────
  let club = await prisma.club.findFirst({ where: { name: 'Velo CC' } })

  if (!club) {
    club = await prisma.club.create({
      data: {
        name: 'Velo CC',
        slogan: 'Pedaleando juntos hacia la cima',
        sport: 'Ciclismo',
        colorTheme: 'blue',
      },
    })

    // BankAccount — no stored balance; computed from BankMovements
    await prisma.bankAccount.create({ data: { clubId: club.id, bankName: 'Banco Demo', holder: 'Velo CC' } })

    // Unified LedgerCategories (income + expense)
    const [cuotas, patrocinios, inscripciones, material, instalaciones, viajes] = await Promise.all([
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Cuotas',                  type: 'INCOME',  color: '#10b981' } }),
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Patrocinios',              type: 'INCOME',  color: '#3b82f6' } }),
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Inscripciones',            type: 'INCOME',  color: '#8b5cf6' } }),
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Material deportivo',       type: 'EXPENSE', color: '#ef4444' } }),
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Instalaciones',            type: 'EXPENSE', color: '#f59e0b' } }),
      prisma.ledgerCategory.create({ data: { clubId: club.id, name: 'Viajes y desplazamientos', type: 'EXPENSE', color: '#06b6d4' } }),
    ])

    // ── 50 socios ───────────────────────────────────────────────────────────
    const socioNames = [
      'Ana García', 'Luis Martín', 'María López', 'Pedro Sánchez', 'Carmen Jiménez',
      'José Rodríguez', 'Isabel Fernández', 'Antonio González', 'Lucía Hernández', 'Manuel Díaz',
      'Rosa Moreno', 'Francisco Muñoz', 'Elena Álvarez', 'Carlos Romero', 'Laura Alonso',
      'David Torres', 'Marta Ramírez', 'Jorge Navarro', 'Sofía Domínguez', 'Alejandro Vázquez',
      'Cristina Ramos', 'Sergio Iglesias', 'Natalia Medina', 'Miguel Castillo', 'Patricia Herrera',
      'Raúl Ortiz', 'Andrea Mora', 'Rubén Delgado', 'Silvia Reyes', 'Pablo Soto',
      'Verónica León', 'Javier Núñez', 'Inés Ruiz', 'Alberto Vargas', 'Sandra Gil',
      'Roberto Fuentes', 'Pilar Blanco', 'Fernando Castro', 'Beatriz Santos', 'Oscar Guzmán',
      'Teresa Calvo', 'Ángel Cano', 'Irene Lozano', 'Hugo Prieto', 'Nuria Moya',
      'Emilio Pascual', 'Esther Cortés', 'Gonzalo Guerrero', 'Alicia Montero', 'Diego Serrano',
    ]

    const hashedPass = await hash('clube1234', 12)
    await Promise.all(
      socioNames.map((name, i) => {
        const email = `socio${i + 1}@velo.cc`
        return prisma.user.upsert({
          where: { email },
          update: {},
          create: { name, email, password: hashedPass, role: 'SOCIO' },
        })
      })
    )
    const socios = await prisma.user.findMany({
      where: { email: { startsWith: 'socio', endsWith: '@velo.cc' } },
      orderBy: { email: 'asc' },
    })

    const joinDates = socios.map((_, i) => {
      const d = new Date('2025-10-01')
      d.setDate(d.getDate() + i * 3)
      return d
    })

    const socioMemberships = await Promise.all(
      socios.map((s, i) =>
        prisma.clubMembership.upsert({
          where: { userId_clubId: { userId: s.id, clubId: club!.id } },
          update: {},
          create: {
            userId: s.id,
            clubId: club!.id,
            role: 'SOCIO',
            status: i < 45 ? 'APPROVED' : 'PENDING',
            joinedAt: joinDates[i],
          },
        })
      )
    )

    // Cuotas 2026 (approved socios) — with dueDate
    const approvedMemberships = socioMemberships.filter((_, i) => i < 45)
    await prisma.memberQuota.createMany({
      skipDuplicates: true,
      data: approvedMemberships.map((m, i) => ({
        membershipId: m.id,
        clubId: club!.id,
        year: 2026,
        amount: 120,
        status: i < 38 ? 'PAID' : 'PENDING',
        dueDate: new Date('2026-03-31'),  // Q1 deadline
        paidAt: i < 38 ? new Date('2026-01-15') : undefined,
      })),
    })

    // ── BankMovements: 6 months Oct 2025 – Mar 2026 (append-only ledger) ──────
    await prisma.bankMovement.createMany({
      data: [
        // Oct 2025
        { clubId: club!.id, type: 'INCOME',  amount: 1200, description: 'Patrocinio Ciclotienda Pro',             date: new Date('2025-10-05'), categoryId: patrocinios.id,  source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 2400, description: 'Cuotas octubre 2025 (20 socios)',        date: new Date('2025-10-10'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios octubre',            date: new Date('2025-10-20'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 480,  description: 'Cascos y gafas de repuesto',             date: new Date('2025-10-25'), categoryId: material.id,     source: 'MANUAL' },
        // Nov 2025
        { clubId: club!.id, type: 'INCOME',  amount: 2640, description: 'Cuotas noviembre 2025 (22 socios)',      date: new Date('2025-11-05'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 600,  description: 'Inscripción carrera popular',            date: new Date('2025-11-08'), categoryId: inscripciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 890,  description: 'Equipación invierno (mallots térmicos)', date: new Date('2025-11-15'), categoryId: material.id,     source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios noviembre',          date: new Date('2025-11-20'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 240,  description: 'Transporte a carrera La Rioja',          date: new Date('2025-11-22'), categoryId: viajes.id,       source: 'MANUAL' },
        // Dic 2025
        { clubId: club!.id, type: 'INCOME',  amount: 3000, description: 'Cuotas diciembre 2025 (25 socios)',      date: new Date('2025-12-03'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 1500, description: 'Subvención Ayuntamiento deporte',        date: new Date('2025-12-10'), categoryId: patrocinios.id,  source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios diciembre',          date: new Date('2025-12-15'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 560,  description: 'Cena de navidad del club',               date: new Date('2025-12-20'), categoryId: material.id,     source: 'MANUAL' },
        // Ene 2026
        { clubId: club!.id, type: 'INCOME',  amount: 4200, description: 'Cuotas enero 2026 (35 socios)',          date: new Date('2026-01-08'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 800,  description: 'Patrocinio Café Isidro',                 date: new Date('2026-01-12'), categoryId: patrocinios.id,  source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios enero',              date: new Date('2026-01-18'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 320,  description: 'Herramientas y accesorios mecánica',     date: new Date('2026-01-25'), categoryId: material.id,     source: 'MANUAL' },
        // Feb 2026
        { clubId: club!.id, type: 'INCOME',  amount: 4800, description: 'Cuotas febrero 2026 (40 socios)',        date: new Date('2026-02-05'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 900,  description: 'Inscripciones ruta cicloturista feb',    date: new Date('2026-02-10'), categoryId: inscripciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios febrero',            date: new Date('2026-02-15'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 650,  description: 'Autocar ruta Mallorca',                  date: new Date('2026-02-22'), categoryId: viajes.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 180,  description: 'Reparación rodillo formación',           date: new Date('2026-02-25'), categoryId: material.id,     source: 'MANUAL' },
        // Mar 2026
        { clubId: club!.id, type: 'INCOME',  amount: 5400, description: 'Cuotas marzo 2026 (45 socios)',          date: new Date('2026-03-05'), categoryId: cuotas.id,       source: 'MANUAL' },
        { clubId: club!.id, type: 'INCOME',  amount: 2000, description: 'Patrocinio principal BiciShop',          date: new Date('2026-03-10'), categoryId: patrocinios.id,  source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 350,  description: 'Alquiler vestuarios marzo',              date: new Date('2026-03-15'), categoryId: instalaciones.id, source: 'MANUAL' },
        { clubId: club!.id, type: 'EXPENSE', amount: 1200, description: 'Maillots equipación 2026 (adelanto)',    date: new Date('2026-03-18'), categoryId: material.id,     source: 'MANUAL' },
      ],
    })

    // ── Products ────────────────────────────────────────────────────────────
    const maillot = await prisma.product.create({
      data: {
        clubId: club!.id,
        name: 'Maillot Oficial 2026',
        description: 'Maillot de verano con tejido técnico transpirable. Diseño exclusivo Velo CC.',
        price: 65,
        availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        totalStock: 100,
      },
    })
    const culotte = await prisma.product.create({
      data: {
        clubId: club!.id,
        name: 'Culotte Bib 2026',
        description: 'Culotte con badana de gel premium, tirantes ergonómicos.',
        price: 89,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        totalStock: 80,
      },
    })
    const cortavientos = await prisma.product.create({
      data: {
        clubId: club!.id,
        name: 'Cortavientos Club 2026',
        description: 'Cortavientos ultraligero impermeable con logo Velo CC.',
        price: 55,
        availableSizes: ['S', 'M', 'L', 'XL'],
        totalStock: 60,
      },
    })

    await prisma.purchaseWindow.create({
      data: {
        clubId: club!.id,
        name: 'Equipación Primavera-Verano 2026',
        status: 'OPEN',
        openedAt: new Date('2026-03-01'),
        products: { create: [{ productId: maillot.id }, { productId: culotte.id }, { productId: cortavientos.id }] },
      },
    })

    // ── Vote ────────────────────────────────────────────────────────────────
    await prisma.vote.create({
      data: {
        clubId: club!.id,
        title: '¿Dónde hacemos el camp de verano 2026?',
        description: 'Vota por el destino del camp de entrenamiento intensivo de julio.',
        options: {
          create: [
            { text: 'Pirineos — Ainsa/Broto', order: 0 },
            { text: 'Sierra Nevada — Granada', order: 1 },
            { text: 'Mallorca — Sa Calobra', order: 2 },
            { text: 'Cantabria — Picos de Europa', order: 3 },
          ],
        },
      },
    })

    // ── 24 events over 6 months ─────────────────────────────────────────────
    const eventTemplates = [
      // Oct 2025 (past)
      { type: 'TRAINING', title: 'Entrenamiento semanal — Ruta de los Pinares', location: 'Concentración parking BiciShop', startAt: '2025-10-04T08:00:00', endAt: '2025-10-04T11:30:00', desc: 'Ruta de 65km con 800m desnivel. Nivel medio. Llevar agua y gel.', published: true },
      { type: 'MEETING', title: 'Asamblea de socios octubre', location: 'Bar La Peña, Sala reservada', startAt: '2025-10-08T19:30:00', endAt: '2025-10-08T21:00:00', desc: 'Revisión de estatutos y elección de nueva junta directiva.', published: true },
      { type: 'TRAINING', title: 'Entrenamiento rodaje suave', location: 'Circuito periurbano norte', startAt: '2025-10-11T09:00:00', endAt: '2025-10-11T11:00:00', desc: 'Rodaje de recuperación a ritmo bajo. Apto para todos los niveles.', published: true },
      { type: 'RACE', title: 'Carrera Popular Otoño — La Rioja', location: 'Logroño, salida Paseo del Espolón', startAt: '2025-10-25T09:30:00', endAt: '2025-10-25T14:00:00', desc: 'Participamos como club en la 35ª Carrera Popular de Logroño. Distancias: 10K y 21K.', maxAttendees: 20, published: true },
      // Nov 2025 (past)
      { type: 'TRAINING', title: 'Entrenamiento cuestas — Puerto del Pico', location: 'Km 0 Carretera del Puerto', startAt: '2025-11-01T08:30:00', endAt: '2025-11-01T12:00:00', desc: 'Sesión de subidas. 3 repeticiones del puerto completo. Nivel avanzado.', published: true },
      { type: 'TRAINING', title: 'Entrenamiento técnica — Llanos del Viento', location: 'Polígono industrial este', startAt: '2025-11-08T09:00:00', endAt: '2025-11-08T11:30:00', desc: 'Trabajo de técnica de pedaleo y postura. Traer zapatillas SPD.', published: true },
      { type: 'SOCIAL', title: 'Cena de bienvenida nuevos socios', location: 'Restaurante El Ciclista', startAt: '2025-11-14T21:00:00', endAt: '2025-11-14T23:30:00', desc: 'Noche de presentación de los 15 nuevos socios incorporados este otoño. ¡Todos bienvenidos!', maxAttendees: 60, published: true },
      { type: 'TRAINING', title: 'Entrenamiento Fuerza-Resistencia', location: 'Polígono norte, circuito 12km', startAt: '2025-11-22T09:00:00', endAt: '2025-11-22T12:30:00', desc: 'Intervalos de alta intensidad intercalados con recuperación activa.', published: true },
      // Dic 2025 (past)
      { type: 'TRAINING', title: 'Ruta larga diciembre — 100km', location: 'Parking Estadio Municipal', startAt: '2025-12-06T07:45:00', endAt: '2025-12-06T13:00:00', desc: 'Ruta de 100km por las sierras. Previsión de frío, llevar ropa de abrigo.', published: true },
      { type: 'MEETING', title: 'Reunión comité técnico', location: 'Sede del club', startAt: '2025-12-10T18:00:00', endAt: '2025-12-10T19:30:00', desc: 'Planificación del calendario de competición 2026 y objetivos deportivos.', published: true },
      { type: 'SOCIAL', title: 'Cena de Navidad del Club', location: 'Asador El Ciclista Clásico', startAt: '2025-12-19T21:00:00', endAt: '2025-12-19T23:59:00', desc: 'Cena anual de hermandad. Menú navideño y entrega de premios de la temporada 2025.', maxAttendees: 80, published: true },
      // Ene 2026 (past)
      { type: 'TRAINING', title: 'Rodaje de inicio de año', location: 'Circuito periurbano sur', startAt: '2026-01-10T10:00:00', endAt: '2026-01-10T12:00:00', desc: 'Primer entrenamiento del 2026. Ritmo tranquilo para retomar el tono.', published: true },
      { type: 'TRAINING', title: 'Intervalos en llano', location: 'Carretera comarcal C-234', startAt: '2026-01-17T09:00:00', endAt: '2026-01-17T11:30:00', desc: 'Series de 8×4min al 90% FTP. Traer potenciómetro o pulsómetro.', published: true },
      { type: 'MEETING', title: 'Charla: Nutrición en ciclismo', location: 'Sala multiusos Centro Cívico', startAt: '2026-01-21T19:00:00', endAt: '2026-01-21T20:30:00', desc: 'Charla con nutricionista deportiva Dra. Irene Campos sobre alimentación en ruta.', published: true },
      { type: 'TRAINING', title: 'Ruta Monte Calvario — Nivel avanzado', location: 'Plaza Mayor', startAt: '2026-01-31T08:00:00', endAt: '2026-01-31T13:00:00', desc: '130km, 1800m de desnivel. Solo para ciclistas con base de rodaje. Ritmo competitivo.', maxAttendees: 15, published: true },
      // Feb 2026 (past)
      { type: 'TRAINING', title: 'Entrenamiento estabilidad core', location: 'Polideportivo Municipal — Sala Fitness', startAt: '2026-02-04T18:30:00', endAt: '2026-02-04T19:30:00', desc: 'Sesión de gym complementario. Trabajo de core y movilidad. Traer ropa deportiva.', published: true },
      { type: 'TRIP', title: 'Concentración Mallorca — 3 días', location: 'Hotel Formentor, Mallorca', startAt: '2026-02-20T07:00:00', endAt: '2026-02-22T20:00:00', desc: 'Concentración de pretemporada en Mallorca. Rutas: Sa Calobra, Cap Formentor y Puig Major. Precio por persona: 280€ (hotel + transporte).', maxAttendees: 25, published: true },
      { type: 'TRAINING', title: 'Recuperación post-concentración', location: 'Circuito periurbano norte', startAt: '2026-02-25T10:00:00', endAt: '2026-02-25T11:30:00', desc: 'Rodaje suave de recuperación tras la concentración de Mallorca.', published: true },
      // Mar 2026 — current month
      { type: 'TRAINING', title: 'Entrenamiento intensidad media', location: 'Carretera del embalse', startAt: '2026-03-07T09:00:00', endAt: '2026-03-07T12:00:00', desc: '75km a intensidad media-alta. Trabajo de resistencia aeróbica.', published: true },
      { type: 'RACE', title: 'Trofeo Primavera — Etapa 1', location: 'Circuito urbano Centro', startAt: '2026-03-15T10:00:00', endAt: '2026-03-15T14:00:00', desc: 'Primera etapa del trofeo local. Circuito de 80km con 600m desnivel acumulado.', maxAttendees: 18, published: true },
      { type: 'MEETING', title: 'Asamblea extraordinaria — Nuevo reglamento', location: 'Sede del club', startAt: '2026-03-18T19:00:00', endAt: '2026-03-18T20:30:00', desc: 'Votación del nuevo reglamento interno. Asistencia obligatoria para socios con derecho a voto.', published: true },
      // Apr-May 2026 (future)
      { type: 'RACE', title: 'Gran Fondo Primavera 2026', location: 'Salida desde el Ayuntamiento', startAt: '2026-04-05T08:00:00', endAt: '2026-04-05T14:00:00', desc: 'Gran evento de temporada. Recorrido de 120km con 1.400m de desnivel. Inscripción libre para todos los socios. Habrá asistencia técnica en ruta.', maxAttendees: 40, published: true },
      { type: 'TRAINING', title: 'Entrenamiento pre-vuelta', location: 'Salida sede club', startAt: '2026-04-18T08:30:00', endAt: '2026-04-18T12:30:00', desc: 'Preparación específica para la Vuelta Cicloturista. Ruta de 90km con puertos.', published: true },
      { type: 'TRIP', title: 'Camp de Verano — Pirineos', location: 'Ainsa, Huesca', startAt: '2026-07-10T09:00:00', endAt: '2026-07-15T18:00:00', desc: 'Camp anual de entrenamiento intensivo en el Pirineo Aragonés. 5 días con rutas épicas: Coll de Pourtalet, Portalet, Bielsa... Precio: 450€ (media pensión + guía).', maxAttendees: 30, published: false },
    ]

    for (const ev of eventTemplates) {
      await prisma.clubEvent.create({
        data: {
          clubId: club!.id,
          authorId: adminUser.id,
          type: ev.type as any,
          title: ev.title,
          description: ev.desc,
          location: ev.location,
          startAt: new Date(ev.startAt),
          endAt: ev.endAt ? new Date(ev.endAt) : null,
          maxAttendees: ev.maxAttendees ?? null,
          published: ev.published,
        },
      })
    }

    // Subscription (PREMIUM plan for a rich demo)
    await prisma.clubSubscription.create({
      data: { clubId: club!.id, plan: 'PREMIUM', memberLimit: 500, validFrom: new Date('2026-01-01'), notes: 'Demo club' },
    })

    console.log(`Club created: ${club!.name} (id: ${club!.id}) with 50 socios and 24 events`)
  }

  // ── Admin membership (always ensure it exists) ───────────────────────────
  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: adminUser.id, clubId: club!.id } },
    update: { role: 'CLUB_ADMIN', status: 'APPROVED' },
    create: { userId: adminUser.id, clubId: club!.id, role: 'CLUB_ADMIN', status: 'APPROVED', joinedAt: new Date('2024-01-15') },
  })

  console.log('\n✅ Seed completado!')
  console.log('\nCredenciales de acceso:')
  console.log('  Super Admin:  superadmin@clube.app  / clube1234  → /superadmin/login')
  console.log('  Admin club:   admin@velo.cc         / clube1234')
  console.log('  Socio:        socio1@velo.cc        / clube1234  (Ana García)')
  console.log('  Socio:        socio10@velo.cc       / clube1234  (Manuel Díaz)')
  console.log('\nURL principal: http://localhost:3000/login')
  console.log('URL SuperAdmin: http://localhost:3000/superadmin/login')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
