import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { requireClubAccess } from '@/lib/authz'
import { err, ok } from '@/lib/utils'

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

function isCloudinaryConfigured() {
  return CLOUD_NAME && API_KEY && API_SECRET
}

/**
 * POST /api/upload/logo?clubId=xxx
 * Accepts multipart/form-data with a `file` field (image).
 * Uploads to Cloudinary under folder `clubs/{clubId}/logo` and returns { url }.
 * Falls back to 501 when Cloudinary credentials are not configured.
 */
export async function POST(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId')
  if (!clubId) return err('Falta el parámetro clubId', 400)

  const access = await requireClubAccess(clubId, 'ADMIN')
  if (!access.ok) return access.response

  if (!isCloudinaryConfigured()) {
    return err('El servicio de subida de imágenes no está configurado. Proporciona la URL del logo manualmente.', 501)
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return err('No se pudo leer el archivo', 400)

  const file = formData.get('file') as File | null
  if (!file) return err('No se encontró el campo "file"', 400)

  if (!file.type.startsWith('image/')) return err('Solo se permiten imágenes', 400)
  if (file.size > 2 * 1024 * 1024) return err('El archivo no puede superar 2 MB', 400)

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const folder = `clubs/${clubId}/logo`
  const publicId = `${clubId}_logo`

  // Build Cloudinary signed upload
  const toSign = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')

  const cloudFormData = new FormData()
  cloudFormData.append('file', file)
  cloudFormData.append('api_key', API_KEY!)
  cloudFormData.append('timestamp', timestamp)
  cloudFormData.append('signature', signature)
  cloudFormData.append('folder', folder)
  cloudFormData.append('public_id', publicId)
  cloudFormData.append('overwrite', 'true')

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: cloudFormData },
  )

  if (!cloudRes.ok) {
    const detail = await cloudRes.text()
    console.error('[upload/logo] Cloudinary error:', detail)
    return err('Error al subir la imagen al servicio de almacenamiento', 502)
  }

  const cloudData = await cloudRes.json()
  return ok({ url: cloudData.secure_url as string })
}
