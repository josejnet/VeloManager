import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateInvoiceSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(300),
  supplier: z.string().min(1).max(200),
  fileUrl: z.string().url().optional(),
  date: z.string().optional(),
  expenseCategoryId: z.string().optional(),
})

// GET /api/clubs/[clubId]/accounting/invoices
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const approvedParam = req.nextUrl.searchParams.get('approved')
  const where = {
    clubId: params.clubId,
    ...(approvedParam !== null ? { approved: approvedParam === 'true' } : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ])

  return ok(buildPaginatedResponse(invoices, total, page, pageSize))
}

// POST /api/clubs/[clubId]/accounting/invoices — create invoice (pending approval)
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateInvoiceSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const invoice = await prisma.invoice.create({
    data: {
      clubId: params.clubId,
      amount: parsed.data.amount,
      description: parsed.data.description,
      supplier: parsed.data.supplier,
      fileUrl: parsed.data.fileUrl,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.INVOICE_CREATED,
    entity: 'Invoice',
    entityId: invoice.id,
    details: { supplier: invoice.supplier, amount: invoice.amount },
  })

  return ok(invoice, 201)
}
