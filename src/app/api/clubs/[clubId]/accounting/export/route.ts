import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { err } from '@/lib/utils'
import { applyRateLimit } from '@/lib/rate-limit'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clubs/[clubId]/accounting/export
 *
 * Query params:
 *   from      ISO date string (inclusive)
 *   to        ISO date string (inclusive, end of day)
 *   type      INCOME | EXPENSE (optional)
 *   source    FEE | EVENT | ORDER | INVOICE | MANUAL | ADJUSTMENT (optional)
 *   format    csv (default) | xlsx
 *
 * Returns a downloadable CSV or XLSX file of BankMovements.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const limited = applyRateLimit(req)
  if (limited) return limited

  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')
  const type = sp.get('type') as 'INCOME' | 'EXPENSE' | null
  const source = sp.get('source') as string | null
  const format = sp.get('format') ?? 'csv'

  const where: Record<string, unknown> = { clubId: params.clubId }

  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
    }
  }
  if (type) where.type = type
  if (source) where.source = source

  const movements = await prisma.bankMovement.findMany({
    where: where as Parameters<typeof prisma.bankMovement.findMany>[0]['where'],
    orderBy: { date: 'asc' },
    include: {
      category: { select: { name: true } },
    },
  })

  // Build rows
  const rows = movements.map((m) => ({
    Fecha: m.date.toISOString().slice(0, 10),
    Tipo: m.type === 'INCOME' ? 'Ingreso' : 'Gasto',
    Fuente: m.source,
    Descripción: m.description,
    Categoría: m.category?.name ?? '',
    Importe: m.type === 'INCOME'
      ? parseFloat(m.amount.toString())
      : -parseFloat(m.amount.toString()),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

  if (format === 'xlsx') {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="contabilidad-${params.clubId}.xlsx"`,
      },
    })
  }

  // Default: CSV
  const csv = XLSX.utils.sheet_to_csv(ws)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contabilidad-${params.clubId}.csv"`,
    },
  })
}
