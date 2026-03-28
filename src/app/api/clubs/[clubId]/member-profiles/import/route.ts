import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { writeAudit } from '@/lib/audit'

const MAX_ROWS = 500

// Column header aliases (case-insensitive)
const COL_MAP: Record<string, string> = {
  email: 'email',
  nombre: 'firstName',
  name: 'firstName',
  firstname: 'firstName',
  apellidos: 'lastName',
  lastname: 'lastName',
  surname: 'lastName',
  'teléfono': 'phone',
  telefono: 'phone',
  phone: 'phone',
  'dirección': 'address',
  direccion: 'address',
  address: 'address',
  ciudad: 'city',
  city: 'city',
  'códigopostal': 'postalCode',
  codigopostal: 'postalCode',
  postalcode: 'postalCode',
  zip: 'postalCode',
  fechanacimiento: 'birthDate',
  birthdate: 'birthDate',
  'fecha nacimiento': 'birthDate',
  numcamiseta: 'jerseyNumber',
  'num camiseta': 'jerseyNumber',
  jerseynumber: 'jerseyNumber',
  jersey: 'jerseyNumber',
  numlicencia: 'licenseNumber',
  'num licencia': 'licenseNumber',
  licensenumber: 'licenseNumber',
  license: 'licenseNumber',
  licencia: 'licenseNumber',
  fechaalta: 'joinDate',
  'fecha alta': 'joinDate',
  joindate: 'joinDate',
  notas: 'notes',
  notes: 'notes',
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const s = String(val).trim()
  if (!s) return null
  // Handle Excel serial numbers
  if (/^\d+$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s))
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

// POST /api/clubs/[clubId]/member-profiles/import
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return err('No se pudo leer el formulario', 400)
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return err('Se requiere un archivo Excel (.xlsx / .xls)', 400)
  }

  const arrayBuffer = await (file as Blob).arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    return err('No se pudo leer el archivo. Asegúrate de que es un Excel válido (.xlsx / .xls)', 400)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return err('El archivo no contiene hojas', 400)

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]

  if (rawRows.length < 2) {
    return ok({ imported: 0, skipped: 0, errors: [] })
  }

  // Map headers
  const headerRow = rawRows[0]
  const colIndexToField: Record<number, string> = {}
  headerRow.forEach((h, i) => {
    const normalized = normalizeHeader(String(h ?? ''))
    const field = COL_MAP[normalized]
    if (field) colIndexToField[i] = field
  })

  const dataRows = rawRows.slice(1)
  if (dataRows.length > MAX_ROWS) {
    return err(`El archivo supera el límite de ${MAX_ROWS} filas`, 400)
  }

  let imported = 0
  let skipped = 0
  const errors: { row: number; email: string; reason: string }[] = []

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const rawRow = dataRows[rowIndex]
    const rowNum = rowIndex + 2 // 1-based, skipping header

    // Build field map
    const fields: Record<string, unknown> = {}
    Object.entries(colIndexToField).forEach(([colIdx, field]) => {
      fields[field] = rawRow[parseInt(colIdx)] ?? null
    })

    const email = String(fields.email ?? '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, email: email || '(vacío)', reason: 'Email inválido o vacío' })
      continue
    }

    const firstName = String(fields.firstName ?? '').trim()
    const lastName = String(fields.lastName ?? '').trim()

    if (!firstName) {
      errors.push({ row: rowNum, email, reason: 'El nombre es obligatorio' })
      continue
    }
    if (!lastName) {
      errors.push({ row: rowNum, email, reason: 'Los apellidos son obligatorios' })
      continue
    }

    // Check if profile already exists
    const existing = await prisma.clubMemberProfile.findUnique({
      where: { clubId_email: { clubId: params.clubId, email } },
    })
    if (existing) {
      skipped++
      continue
    }

    // Auto-link check
    let userId: string | null = null
    let membershipId: string | null = null
    let status: 'UNREGISTERED' | 'LINKED' = 'UNREGISTERED'

    try {
      const matchedUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      if (matchedUser) {
        const membership = await prisma.clubMembership.findUnique({
          where: { userId_clubId: { userId: matchedUser.id, clubId: params.clubId } },
          select: { id: true, status: true },
        })
        if (membership && membership.status === 'APPROVED') {
          userId = matchedUser.id
          membershipId = membership.id
          status = 'LINKED'
        }
      }

      await prisma.clubMemberProfile.create({
        data: {
          clubId: params.clubId,
          email,
          firstName,
          lastName,
          phone: fields.phone ? String(fields.phone).trim().slice(0, 30) || null : null,
          address: fields.address ? String(fields.address).trim().slice(0, 200) || null : null,
          city: fields.city ? String(fields.city).trim().slice(0, 100) || null : null,
          postalCode: fields.postalCode ? String(fields.postalCode).trim().slice(0, 20) || null : null,
          birthDate: parseDate(fields.birthDate),
          jerseyNumber: fields.jerseyNumber ? String(fields.jerseyNumber).trim().slice(0, 20) || null : null,
          licenseNumber: fields.licenseNumber ? String(fields.licenseNumber).trim().slice(0, 50) || null : null,
          joinDate: parseDate(fields.joinDate),
          notes: fields.notes ? String(fields.notes).trim().slice(0, 2000) || null : null,
          status,
          userId,
          membershipId,
        },
      })

      imported++
    } catch (e) {
      errors.push({ row: rowNum, email, reason: 'Error al crear el perfil' })
      console.error(`[MemberProfileImport] row ${rowNum}`, e)
    }
  }

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_PROFILE_IMPORTED',
    entity: 'ClubMemberProfile',
    details: { imported, skipped, errors: errors.length },
  })

  return ok({ imported, skipped, errors })
}
