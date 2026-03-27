import type {
  User,
  Club,
  ClubMembership,
  BankAccount,
  BankMovement,
  LedgerCategory,
  Invoice,
  MemberQuota,
  Product,
  PurchaseWindow,
  Order,
  OrderItem,
  Vote,
  VoteOption,
  VoteResponse,
  AuditLog,
  Notification,
  SizeGroup,
} from '@prisma/client'

export type {
  User,
  Club,
  ClubMembership,
  BankAccount,
  BankMovement,
  LedgerCategory,
  Invoice,
  MemberQuota,
  Product,
  PurchaseWindow,
  Order,
  OrderItem,
  Vote,
  VoteOption,
  VoteResponse,
  AuditLog,
  Notification,
  SizeGroup,
}

// ─── Paginated response wrapper ───────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── API error ────────────────────────────────────────────────────────────
export interface ApiError {
  error: string
  code?: string
}

// ─── Session / Auth ───────────────────────────────────────────────────────
export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  // Active club context (set after user selects a club)
  clubId?: string
  clubRole?: string
}

// ─── Club context (enriched) ─────────────────────────────────────────────
export type ClubWithBalance = Club & {
  bankAccount: BankAccount | null
  _count: { memberships: number }
}

// ─── Member (enriched) ───────────────────────────────────────────────────
export type MemberWithUser = ClubMembership & {
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl' | 'createdAt'>
  quotas: MemberQuota[]
}

// ─── BankMovement (enriched) ─────────────────────────────────────────────
export type MovementWithCategory = BankMovement & {
  category: LedgerCategory | null
}

// ─── Order (enriched) ────────────────────────────────────────────────────
export type OrderWithItems = Order & {
  user: Pick<User, 'id' | 'name' | 'email'>
  items: (OrderItem & { product: Pick<Product, 'id' | 'name' | 'images'> })[]
}

// ─── Vote (enriched) ─────────────────────────────────────────────────────
export type VoteWithResults = Vote & {
  options: (VoteOption & { _count: { responses: number } })[]
  _count: { responses: number }
  userVoted?: boolean
  userOptionId?: string
}

// ─── Audit log (enriched) ────────────────────────────────────────────────
export type AuditLogWithUser = AuditLog & {
  user: Pick<User, 'id' | 'name' | 'email'>
}

// ─── Purchase window (enriched) ──────────────────────────────────────────
export type PurchaseWindowWithProducts = PurchaseWindow & {
  products: { product: Product }[]
  _count: { orders: number }
}

// ─── Report: units by product + size ─────────────────────────────────────
export interface ProductSizeReport {
  productId: string
  productName: string
  size: string
  totalQuantity: number
}

export interface CampaignReport {
  window: PurchaseWindow
  summary: ProductSizeReport[]
  orders: OrderWithItems[]
}

// ─── Color themes ────────────────────────────────────────────────────────
export type ThemeKey =
  | 'blue'
  | 'orange'
  | 'green'
  | 'red'
  | 'purple'
  | 'yellow'
  | 'teal'
  | 'slate'

export interface ThemeConfig {
  key: ThemeKey
  label: string
  sport: string
  primary: string      // RGB values e.g. "37 99 235"
  primaryDark: string
  primaryLight: string
  secondary: string
  accent: string
}
