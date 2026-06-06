import type { Cart, Coffee, Round, PriceBreakdown } from './types'

export function fmtPrice(n: number): string {
  return Math.round(n).toLocaleString('nb-NO') + ' kr'
}

export function fmtDeadline(iso: string): string {
  if (!iso) return ''
  const parts = String(iso).slice(0, 10).split('-')
  if (parts.length < 3) return iso
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (isNaN(d.getTime())) return iso
  const weekday = d.toLocaleDateString('nb-NO', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('nb-NO', { month: 'long' })
  return weekday + ' ' + day + '. ' + month
}

// Prices in the DB are ex-VAT. Members see inc-VAT; admin sees ex-VAT.
// The admin fee is treated as a flat cooperative fee — VAT is not applied to it.
export function priceBreakdown(
  items: Record<string, number> | { id: string; qty: number }[],
  catalog: Coffee[],
  round: Round | null
): PriceBreakdown {
  const lines = Array.isArray(items)
    ? items.map((x) => ({ id: x.id, qty: x.qty }))
    : Object.entries(items).map(([id, qty]) => ({ id, qty }))

  const priceOf = (id: string) => catalog.find((x) => x.id === id)?.price ?? 0
  const bags = lines.reduce((a, l) => a + l.qty, 0)
  const adminFee = round?.admin_fee ?? 0
  const vatRate = round?.vat_rate ?? 0
  const vatMul = 1 + vatRate / 100

  const varesumEx = lines.reduce((a, l) => a + l.qty * priceOf(l.id), 0)
  const varesum = varesumEx * vatMul        // member-facing inc-VAT
  const mva = varesum - varesumEx           // VAT portion
  const gebyr = adminFee * bags             // no VAT on the fee
  const total = varesum + gebyr             // what the member pays

  return { bags, varesum, varesumEx, gebyr, adminFee, vatRate, mva, total }
}

// Per-bag inc-VAT price for member display.
export function priceIncVat(price: number, vatRate: number): number {
  return price * (1 + vatRate / 100)
}

export function cartTotals(cart: Cart, catalog: Coffee[]) {
  const lines = catalog
    .filter((c) => cart[c.id])
    .map((c) => ({ ...c, qty: cart[c.id], sum: cart[c.id] * c.price }))
  return {
    bags: lines.reduce((a, b) => a + b.qty, 0),
    total: lines.reduce((a, b) => a + b.sum, 0),
    lines,
  }
}

export function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('kaffi_' + key)
    return v == null ? fallback : JSON.parse(v) as T
  } catch {
    return fallback
  }
}

export function save(key: string, val: unknown): void {
  try { localStorage.setItem('kaffi_' + key, JSON.stringify(val)) } catch { /* ignore */ }
}
