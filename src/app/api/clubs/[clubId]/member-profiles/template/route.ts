import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireClubAccess } from '@/lib/authz'

// GET /api/clubs/[clubId]/member-profiles/template
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const headers = [
    'Email',
    'Nombre',
    'Apellidos',
    'Teléfono',
    'Dirección',
    'Ciudad',
    'CódigoPostal',
    'FechaNacimiento',
    'NumCamiseta',
    'NumLicencia',
    'FechaAlta',
    'Notas',
  ]

  const exampleRows = [
    [
      'carlos.garcia@correo.es',
      'Carlos',
      'García López',
      '612345678',
      'Calle Mayor 12, 3º B',
      'Madrid',
      '28001',
      '1990-05-15',
      '7',
      'FED-2024-001234',
      '2024-01-10',
      'Miembro fundador del club',
    ],
    [
      'ana.martinez@correo.es',
      'Ana',
      'Martínez Ruiz',
      '634567890',
      'Av. de la Constitución 45',
      'Sevilla',
      '41001',
      '1985-11-23',
      '22',
      'FED-2024-005678',
      '2024-02-01',
      '',
    ],
    [
      'javier.fernandez@correo.es',
      'Javier',
      'Fernández Torres',
      '698765432',
      'Passeig de Gràcia 88',
      'Barcelona',
      '08008',
      '1995-03-07',
      '15',
      'FED-2024-009012',
      '2024-03-15',
      'Ciclista de montaña, categoría élite',
    ],
  ]

  const worksheetData = [headers, ...exampleRows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Set column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Email
    { wch: 15 }, // Nombre
    { wch: 20 }, // Apellidos
    { wch: 14 }, // Teléfono
    { wch: 30 }, // Dirección
    { wch: 15 }, // Ciudad
    { wch: 14 }, // CódigoPostal
    { wch: 18 }, // FechaNacimiento
    { wch: 12 }, // NumCamiseta
    { wch: 20 }, // NumLicencia
    { wch: 12 }, // FechaAlta
    { wch: 40 }, // Notas
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Socios')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-socios.xlsx"',
    },
  })
}
