/**
 * Module access control.
 * Checks whether a club has access to a given platform module.
 * Used in API routes to gate module-specific endpoints.
 */
import { prisma } from '@/lib/prisma'
import type { SubscriptionPlan } from '@prisma/client'

// Default modules included per plan
export const PLAN_MODULES: Record<SubscriptionPlan, string[]> = {
  FREE: ['members', 'accounting_basic', 'announcements'],
  PRO: ['members', 'accounting', 'purchases', 'votes', 'announcements', 'messaging'],
  PREMIUM: ['members', 'accounting', 'purchases', 'votes', 'announcements', 'messaging', 'events', 'audit', 'reports'],
  ENTERPRISE: ['members', 'accounting', 'purchases', 'votes', 'announcements', 'messaging', 'events', 'audit', 'reports', 'custom_roles', 'api_access'],
}

export const PLAN_MEMBER_LIMITS: Record<SubscriptionPlan, number | null> = {
  FREE: 30,
  PRO: 150,
  PREMIUM: 500,
  ENTERPRISE: null,
}

export const ALL_MODULES = [
  { key: 'members', name: 'Gestión de Socios', icon: 'Users', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'accounting_basic', name: 'Contabilidad básica', icon: 'Wallet', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'accounting', name: 'Contabilidad completa', icon: 'Wallet', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'purchases', name: 'Compras conjuntas', icon: 'ShoppingBag', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'votes', name: 'Votaciones', icon: 'Vote', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'announcements', name: 'Anuncios y archivos', icon: 'Bell', includedInPlans: ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'messaging', name: 'Mensajería interna', icon: 'Mail', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'events', name: 'Calendario de eventos', icon: 'Calendar', includedInPlans: ['PREMIUM', 'ENTERPRISE'] },
  { key: 'audit', name: 'Log de auditoría', icon: 'ShieldCheck', includedInPlans: ['PRO', 'PREMIUM', 'ENTERPRISE'] },
  { key: 'reports', name: 'Informes avanzados', icon: 'BarChart2', includedInPlans: ['PREMIUM', 'ENTERPRISE'] },
  { key: 'custom_roles', name: 'Roles personalizados', icon: 'Badge', includedInPlans: ['ENTERPRISE'] },
] as const

/**
 * Check if a club has access to a specific module.
 * Checks: explicit ClubModuleAccess override OR plan default.
 */
export async function clubHasModule(clubId: string, moduleKey: string): Promise<boolean> {
  // Check explicit override first
  const explicit = await prisma.clubModuleAccess.findFirst({
    where: { clubId, module: { key: moduleKey } },
    include: { module: true },
  })
  if (explicit) return explicit.enabled

  // Fall back to plan
  const subscription = await prisma.clubSubscription.findUnique({
    where: { clubId },
    select: { plan: true },
  })
  const plan = subscription?.plan ?? 'FREE'
  return PLAN_MODULES[plan].includes(moduleKey)
}

/**
 * Get all enabled modules for a club (for UI rendering).
 */
export async function getClubModules(clubId: string): Promise<string[]> {
  const subscription = await prisma.clubSubscription.findUnique({
    where: { clubId },
    select: { plan: true },
  })
  const plan = subscription?.plan ?? 'FREE'
  const planModules = new Set(PLAN_MODULES[plan])

  // Apply explicit overrides
  const overrides = await prisma.clubModuleAccess.findMany({
    where: { clubId },
    include: { module: true },
  })
  for (const o of overrides) {
    if (o.enabled) planModules.add(o.module.key)
    else planModules.delete(o.module.key)
  }

  return [...planModules]
}
