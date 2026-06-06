export interface Coffee {
  id: string
  name: string
  notes: string
  weight: string
  price: number
}

export interface Round {
  id: string
  label: string
  deadline: string
  deadline_iso: string
  status: 'åpen' | 'planlagt' | 'lukket'
  vat_rate: number
  admin_fee: number
}

export interface Member {
  id: string
  name: string
  email: string
  phone: string
  is_admin: boolean
}

export interface OrderItem {
  coffee_id: string
  qty: number
}

export interface MemberOrder {
  id: string
  member: string
  email: string
  placed_at: string
  paid: boolean
  items: Record<string, number>
}

export interface PastOrder {
  id: string
  round_id: string
  label: string
  date: string
  status: string
  paid: boolean
  items: { id: string; qty: number }[]
}

export type Cart = Record<string, number>

export interface PriceBreakdown {
  bags: number
  varesum: number    // inc-VAT — what the member sees
  varesumEx: number  // ex-VAT — for admin / roaster invoice
  gebyr: number      // admin fee × bags (no VAT applied on the fee)
  adminFee: number   // per-bag admin fee (ex-VAT, no VAT applied)
  vatRate: number
  mva: number        // VAT portion of varesum
  total: number      // varesum + gebyr = what the member pays
}

export const ROUND_BADGE: Record<string, { variant: string; label: string }> = {
  'åpen':     { variant: 'safe',   label: 'Åpen for bestilling' },
  'planlagt': { variant: 'warn',   label: 'Planlagt' },
  'lukket':   { variant: 'closed', label: 'Lukket' },
}
