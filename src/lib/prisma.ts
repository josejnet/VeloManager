import { PrismaClient } from '@prisma/client'

// Singleton pattern — prevents multiple PrismaClient instances in development
// due to Next.js hot reloading. In production a single instance is reused.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
