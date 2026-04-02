import { NextRequest } from 'next/server'
import { type MovementSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { err } from '@/lib/utils'
import { applyRateLimit } from '@/lib/rate-limit'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

export const dynamic = 'force-dynamic'

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  clubName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  subtext: {
    fontSize: 9,
    color: '#6b7280',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    gap: 24,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colDate: { width: '14%' },
  colDesc: { width: '48%' },
  colType: { width: '14%' },
  colAmount: { width: '24%', textAlign: 'right' },
  headerText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  memberInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  memberName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 2,
  },
  incomeText: { color: '#059669' },
  expenseText: { color: '#dc2626' },
})

// ─── PDF Component ───────────────────────────────────────────────────────────

interface Movement {
  id: string
  date: Date
  type: 'INCOME' | 'EXPENSE'
  description: string
  amount: string
  source: string
}

interface StatementProps {
  clubName: string
  logoUrl: string | null
  memberName: string
  memberEmail: string
  period: string
  extractionDate: string
  openingBalance: number
  closingBalance: number
  movements: Movement[]
}

function StatementDocument({
  clubName,
  logoUrl,
  memberName,
  memberEmail,
  period,
  extractionDate,
  openingBalance,
  closingBalance,
  movements,
}: StatementProps) {
  const fmt = (n: number) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

  return React.createElement(
    Document,
    { title: `Estado de Cuentas — ${memberName}` },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.clubName }, clubName),
          React.createElement(Text, { style: styles.subtext }, `Estado de Cuentas — ${period}`),
          React.createElement(Text, { style: styles.subtext }, `Fecha de extracción: ${extractionDate}`),
        ),
        logoUrl
          ? React.createElement(Image, { style: styles.logo, src: logoUrl })
          : null,
      ),
      // Member info
      React.createElement(
        View,
        { style: styles.memberInfo },
        React.createElement(Text, { style: styles.memberName }, memberName),
        React.createElement(Text, { style: styles.subtext }, memberEmail),
      ),
      // Balance summary
      React.createElement(
        View,
        { style: styles.summaryBox },
        React.createElement(
          View,
          { style: styles.summaryItem },
          React.createElement(Text, { style: styles.summaryLabel }, 'Saldo inicial'),
          React.createElement(
            Text,
            { style: [styles.summaryValue, openingBalance >= 0 ? styles.incomeText : styles.expenseText] },
            fmt(openingBalance),
          ),
        ),
        React.createElement(
          View,
          { style: styles.summaryItem },
          React.createElement(Text, { style: styles.summaryLabel }, 'Movimientos'),
          React.createElement(Text, { style: styles.summaryValue }, String(movements.length)),
        ),
        React.createElement(
          View,
          { style: styles.summaryItem },
          React.createElement(Text, { style: styles.summaryLabel }, 'Saldo final'),
          React.createElement(
            Text,
            { style: [styles.summaryValue, closingBalance >= 0 ? styles.incomeText : styles.expenseText] },
            fmt(closingBalance),
          ),
        ),
      ),
      // Movements table
      React.createElement(Text, { style: styles.sectionTitle }, 'Detalle de movimientos'),
      // Table header
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: [styles.headerText, styles.colDate] }, 'Fecha'),
        React.createElement(Text, { style: [styles.headerText, styles.colDesc] }, 'Descripción'),
        React.createElement(Text, { style: [styles.headerText, styles.colType] }, 'Tipo'),
        React.createElement(Text, { style: [styles.headerText, styles.colAmount] }, 'Importe'),
      ),
      // Table rows
      ...movements.map((m, idx) =>
        React.createElement(
          View,
          { key: m.id, style: [styles.tableRow, ...(idx % 2 === 1 ? [styles.tableRowAlt] : [])] },
          React.createElement(
            Text,
            { style: [{ fontSize: 9, color: '#6b7280' }, styles.colDate] },
            m.date instanceof Date
              ? m.date.toISOString().slice(0, 10)
              : String(m.date).slice(0, 10),
          ),
          React.createElement(Text, { style: [{ fontSize: 9 }, styles.colDesc] }, m.description),
          React.createElement(
            Text,
            { style: [{ fontSize: 9 }, styles.colType, m.type === 'INCOME' ? styles.incomeText : styles.expenseText] },
            m.type === 'INCOME' ? 'Ingreso' : 'Gasto',
          ),
          React.createElement(
            Text,
            {
              style: [
                { fontSize: 9, fontFamily: 'Helvetica-Bold' },
                styles.colAmount,
                m.type === 'INCOME' ? styles.incomeText : styles.expenseText,
              ],
            },
            `${m.type === 'INCOME' ? '+' : '-'}${fmt(parseFloat(m.amount))}`,
          ),
        ),
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, clubName),
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}` },
          null,
        ),
      ),
    ),
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/clubs/[clubId]/accounting/statement
 *
 * Query params:
 *   membershipId  (required) — the membership whose quotas to include
 *   year          (optional) — e.g. 2024; if omitted, all time
 *
 * Returns a PDF file (Estado de Cuentas).
 * ADMIN only — members can request their own statement separately.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const limited = applyRateLimit(req, 10, 60_000)
  if (limited) return limited

  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const sp = req.nextUrl.searchParams
  const membershipId = sp.get('membershipId')
  const year = sp.get('year') ? parseInt(sp.get('year')!) : null

  if (!membershipId) return err('membershipId es obligatorio')

  // Fetch club and membership
  const [club, membership] = await Promise.all([
    prisma.club.findUnique({
      where: { id: params.clubId },
      select: { name: true, logoUrl: true },
    }),
    prisma.clubMembership.findFirst({
      where: { id: membershipId, clubId: params.clubId },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  if (!club) return err('Club no encontrado', 404)
  if (!membership) return err('Membresía no encontrada', 404)

  // Build date range for movements
  let dateFrom: Date | undefined
  let dateTo: Date | undefined
  if (year) {
    dateFrom = new Date(`${year}-01-01T00:00:00.000Z`)
    dateTo = new Date(`${year}-12-31T23:59:59.999Z`)
  }

  // Fetch quota movements for this member filtered by year
  const quotas = await prisma.memberQuota.findMany({
    where: {
      membershipId,
      ...(year ? { year } : {}),
    },
    orderBy: { year: 'asc' },
  })

  const quotaIds = quotas.map((q) => q.id)

  // Fetch BankMovements for those quotas (source=FEE) and adjustments (refunds)
  const movements = await prisma.bankMovement.findMany({
    where: {
      clubId: params.clubId,
      OR: [
        { source: 'FEE', sourceId: { in: quotaIds } },
        { source: 'ADJUSTMENT', sourceId: { in: quotaIds.map((id) => `refund:quota:${id}`) } },
        ...(dateFrom && dateTo
          ? [{ source: { in: ['MANUAL', 'INVOICE'] as MovementSource[] }, date: { gte: dateFrom, lte: dateTo } }]
          : []),
      ],
    },
    orderBy: { date: 'asc' },
    include: { category: { select: { name: true } } },
  })

  // Member statement shows 0 as opening balance (member-scoped, not club-level)
  const openingBalance = 0

  const incomeSum = movements
    .filter((m) => m.type === 'INCOME')
    .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0)
  const expenseSum = movements
    .filter((m) => m.type === 'EXPENSE')
    .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0)
  const closingBalance = openingBalance + incomeSum - expenseSum

  const period = year
    ? `Año ${year}`
    : 'Histórico completo'

  const extractionDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const doc = React.createElement(StatementDocument, {
    clubName: club.name,
    logoUrl: club.logoUrl,
    memberName: membership.user.name ?? membership.user.email,
    memberEmail: membership.user.email,
    period,
    extractionDate,
    openingBalance,
    closingBalance,
    movements: movements.map((m) => ({
      id: m.id,
      date: m.date,
      type: m.type as 'INCOME' | 'EXPENSE',
      description: m.description,
      amount: m.amount.toString(),
      source: m.source,
    })),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any)

  const safeName = (membership.user.name ?? membership.user.email)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estado-cuentas-${safeName}-${year ?? 'historico'}.pdf"`,
    },
  })
}
