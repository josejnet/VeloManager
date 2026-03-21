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

  // ── Super Admin ─────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@nexus.dev' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@nexus.dev',
      password: await hash('nexus1234', 12),
      role: 'SUPER_ADMIN',
    },
  })
  console.log(`Super Admin: ${superAdmin.email}`)

  // ── Demo club admin ─────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@velonexus.com' },
    update: {},
    create: {
      name: 'Carlos Velo',
      email: 'admin@velonexus.com',
      password: await hash('nexus1234', 12),
      role: 'CLUB_ADMIN',
    },
  })

  // ── Demo socios ─────────────────────────────────────────────────────────
  const socios = await Promise.all(
    [
      { name: 'Ana García', email: 'ana@socio.com' },
      { name: 'Luis Martín', email: 'luis@socio.com' },
      { name: 'María López', email: 'maria@socio.com' },
      { name: 'Pedro Sánchez', email: 'pedro@socio.com' },
    ].map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: { ...s, password: hash('nexus1234', 12).then((h) => h), role: 'SOCIO' },
      })
    )
  )

  // Create socios with hashed passwords
  const hashedSocios = await Promise.all([
    prisma.user.upsert({
      where: { email: 'ana@socio.com' },
      update: {},
      create: { name: 'Ana García', email: 'ana@socio.com', password: await hash('nexus1234', 12), role: 'SOCIO' },
    }),
    prisma.user.upsert({
      where: { email: 'luis@socio.com' },
      update: {},
      create: { name: 'Luis Martín', email: 'luis@socio.com', password: await hash('nexus1234', 12), role: 'SOCIO' },
    }),
    prisma.user.upsert({
      where: { email: 'maria@socio.com' },
      update: {},
      create: { name: 'María López', email: 'maria@socio.com', password: await hash('nexus1234', 12), role: 'SOCIO' },
    }),
  ])

  // ── Demo club ────────────────────────────────────────────────────────────
  let club = await prisma.club.findFirst({ where: { name: 'Velo Nexus CC' } })

  if (!club) {
    club = await prisma.club.create({
      data: {
        name: 'Velo Nexus CC',
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

    // Sample transactions
    await prisma.transaction.createMany({
      data: [
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 1200, description: 'Patrocinio Ciclotienda Pro', date: new Date('2025-01-10'), incomeCategoryId: patrocinios.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 500, description: 'Cuotas enero 2025', date: new Date('2025-01-15'), incomeCategoryId: cuotas.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 350, description: 'Alquiler vestuarios enero', date: new Date('2025-01-20'), expenseCategoryId: instalaciones.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'EXPENSE', amount: 150, description: 'Cámaras y herramientas', date: new Date('2025-02-05'), expenseCategoryId: material.id },
        { bankAccountId: bank.id, clubId: club.id, type: 'INCOME', amount: 2000, description: 'Subvención municipal', date: new Date('2025-02-15'), incomeCategoryId: patrocinios.id },
      ],
    })

    // Quota for approved socio
    const quota = await prisma.memberQuota.create({
      data: {
        membershipId: socioMemberships[1].id,
        clubId: club.id,
        year: 2025,
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
    const window = await prisma.purchaseWindow.create({
      data: {
        clubId: club.id,
        name: 'Equipación 2026',
        status: 'OPEN',
        openedAt: new Date('2025-03-01'),
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

    console.log(`Club created: ${club.name} (id: ${club.id})`)
  }

  console.log('\n✅ Seed completado!')
  console.log('\nCredenciales de acceso:')
  console.log('  Super Admin:  superadmin@nexus.dev  / nexus1234')
  console.log('  Admin club:   admin@velonexus.com   / nexus1234')
  console.log('  Socio:        luis@socio.com        / nexus1234')
  console.log('  Socio (pendiente): ana@socio.com    / nexus1234')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
