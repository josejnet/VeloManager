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

  // ── Demo socios ─────────────────────────────────────────────────────────
  const hashedSocios = await Promise.all([
    prisma.user.upsert({
      where: { email: 'ana@socio.com' },
      update: {},
      create: { name: 'Ana García', email: 'ana@socio.com', password: await hash('clube1234', 12), role: 'SOCIO' },
    }),
    prisma.user.upsert({
      where: { email: 'luis@socio.com' },
      update: {},
      create: { name: 'Luis Martín', email: 'luis@socio.com', password: await hash('clube1234', 12), role: 'SOCIO' },
    }),
    prisma.user.upsert({
      where: { email: 'maria@socio.com' },
      update: {},
      create: { name: 'María López', email: 'maria@socio.com', password: await hash('clube1234', 12), role: 'SOCIO' },
    }),
  ])

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

    // Bank account
    const bank = await prisma.bankAccount.create({
      data: { clubId: club.id, balance: 3200 },
    })

    // Categories
    const [cuotas, patrocinios, material, instalaciones] = await Promise.all([
      prisma.incomeCategory.create({ data: { clubId: club.id, name: 'Cuotas' } }),
      prisma.incomeCategory.create({ data: { clubId: club.id, name: 'Patrocinios' } }),
      prisma.expenseCategory.create({ data: { clubId: club.id, name: 'Material deportivo' } }),
      prisma.expenseCategory.create({ data: { clubId: club.id, name: 'Instalaciones' } }),
    ])

    // Admin membership
    const adminMembership = await prisma.clubMembership.create({
      data: {
        userId: adminUser.id,
        clubId: club.id,
        role: 'CLUB_ADMIN',
        status: 'APPROVED',
        joinedAt: new Date('2024-01-15'),
      },
    })

    // Socios memberships
    const socioMemberships = await Promise.all(
      hashedSocios.map((s, i) =>
        prisma.clubMembership.create({
          data: {
            userId: s.id,
            clubId: club!.id,
            role: 'SOCIO',
            status: i === 0 ? 'PENDING' : 'APPROVED',
            joinedAt: i === 0 ? undefined : new Date('2024-02-01'),
          },
        })
      )
    )

    // Sample transactions (spread across months for charts)
    await prisma.transaction.createMany({
      data: [
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 1200, description: 'Patrocinio Ciclotienda Pro', date: new Date('2025-09-10'), incomeCategoryId: patrocinios.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 500, description: 'Cuotas septiembre', date: new Date('2025-09-15'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 350, description: 'Alquiler vestuarios', date: new Date('2025-09-20'), expenseCategoryId: instalaciones.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 2000, description: 'Subvención municipal', date: new Date('2025-10-15'), incomeCategoryId: patrocinios.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 150, description: 'Cámaras y herramientas', date: new Date('2025-10-20'), expenseCategoryId: material.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 600, description: 'Cuotas noviembre', date: new Date('2025-11-01'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 800, description: 'Equipación invierno', date: new Date('2025-11-15'), expenseCategoryId: material.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 400, description: 'Cuotas diciembre', date: new Date('2025-12-01'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 200, description: 'Material técnico', date: new Date('2025-12-10'), expenseCategoryId: material.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 550, description: 'Cuotas enero 2026', date: new Date('2026-01-05'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 350, description: 'Alquiler vestuarios enero', date: new Date('2026-01-20'), expenseCategoryId: instalaciones.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 300, description: 'Cuotas febrero', date: new Date('2026-02-05'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 180, description: 'Reparaciones varias', date: new Date('2026-02-20'), expenseCategoryId: material.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 450, description: 'Cuotas marzo', date: new Date('2026-03-05'), incomeCategoryId: cuotas.id },
      ],
    })

    // Quota for approved socio
    await prisma.memberQuota.create({
      data: {
        membershipId: socioMemberships[1].id,
        clubId: club.id,
        year: 2026,
        amount: 120,
        status: 'PENDING',
      },
    })

    // Products
    const maillot = await prisma.product.create({
      data: {
        clubId: club.id,
        name: 'Maillot Oficial 2026',
        description: 'Maillot de verano con tejido técnico transpirable',
        price: 65,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        totalStock: 100,
      },
    })

    const culotte = await prisma.product.create({
      data: {
        clubId: club.id,
        name: 'Culotte Bib 2026',
        description: 'Culotte con badana de gel premium',
        price: 89,
        availableSizes: ['S', 'M', 'L', 'XL'],
        totalStock: 80,
      },
    })

    // Open purchase window
    await prisma.purchaseWindow.create({
      data: {
        clubId: club.id,
        name: 'Equipación 2026',
        status: 'OPEN',
        openedAt: new Date('2026-03-01'),
        products: {
          create: [{ productId: maillot.id }, { productId: culotte.id }],
        },
      },
    })

    // Active vote
    await prisma.vote.create({
      data: {
        clubId: club.id,
        title: '¿En qué destino hacemos el camp de verano 2026?',
        description: 'Vota por el destino que prefieres para el camp de entrenamiento de verano.',
        options: {
          create: [
            { text: 'Pirineos (Ordesa)', order: 0 },
            { text: 'Sierra Nevada', order: 1 },
            { text: 'Mallorca', order: 2 },
            { text: 'Cantabria', order: 3 },
          ],
        },
      },
    })

    // Demo event
    await prisma.clubEvent.create({
      data: {
        clubId: club.id,
        authorId: adminUser.id,
        type: 'RACE',
        title: 'Gran Fondo Primavera 2026',
        description: 'Salida conjunta de 120km con diferentes niveles de ritmo. Inscripción libre para todos los socios.',
        location: 'Salida desde el Ayuntamiento',
        startAt: new Date('2026-04-05T08:00:00Z'),
        endAt: new Date('2026-04-05T14:00:00Z'),
        maxAttendees: 30,
        published: true,
      },
    })

    // Subscription (PRO plan)
    await prisma.clubSubscription.create({
      data: {
        clubId: club.id,
        plan: 'PRO',
        memberLimit: 150,
        validFrom: new Date('2026-01-01'),
        notes: 'Plan inicial de demostración',
      },
    })

    console.log(`Club created: ${club.name} (id: ${club.id})`)
  }

  console.log('\n✅ Seed completado!')
  console.log('\nCredenciales de acceso:')
  console.log('  Super Admin:  superadmin@clube.app  / clube1234')
  console.log('  Admin club:   admin@velo.cc         / clube1234')
  console.log('  Socio:        luis@socio.com        / clube1234')
  console.log('  Socio (pendiente): ana@socio.com    / clube1234')
  console.log('\nAcceso SuperAdmin dedicado: /superadmin/login')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
