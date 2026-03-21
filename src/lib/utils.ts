import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tailwind helper ──────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date helpers ─────────────────────────────────────────────────────────
export function fmtDate(date: Date | string) {
  return format(new Date(date), 'dd/MM/yyyy', { locale: es })
}

export function fmtDateTime(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es })
}

export function fmtRelative(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

// ─── Currency ─────────────────────────────────────────────────────────────
export function fmtCurrency(amount: number | string | { toString(): string }) {
  const n = typeof amount === 'object' ? parseFloat(amount.toString()) : Number(amount)
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n)
}

// ─── Pagination ───────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)))
  )
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip, take: pageSize }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── API response helpers ─────────────────────────────────────────────────
export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status })
}

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

// ─── Misc ─────────────────────────────────────────────────────────────────
export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
