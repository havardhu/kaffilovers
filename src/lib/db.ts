import { supabase } from './supabase'
import type { Coffee, Round, Member, MemberOrder, PastOrder, InvitationCampaign } from './types'

// ─── Members ─────────────────────────────────────────────────────

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, name, email, phone, is_admin, verified')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchCurrentMember(id: { email?: string | null; phone?: string | null }): Promise<Member | null> {
  let q = supabase.from('members').select('id, name, email, phone, is_admin').limit(1)
  if (id.email) q = q.ilike('email', id.email)
  else if (id.phone) q = q.eq('phone', id.phone)
  else return null
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMember(m: Partial<Member> & { name: string }): Promise<Member> {
  // Updating an existing row: a plain table write is enough.
  if (m.id) {
    const payload = { name: m.name, email: m.email ?? null, phone: m.phone ?? '', is_admin: m.is_admin ?? false }
    const { data, error } = await supabase.from('members').update(payload).eq('id', m.id).select().single()
    if (error) throw error
    return data
  }
  // Creating a new member: route through Edge Function so the auth user
  // is created in the same step. The function returns the inserted row.
  const { data, error: fnErr } = await supabase.functions.invoke('admin-create-member', {
    body: { name: m.name, email: m.email ?? null, phone: m.phone ?? '', is_admin: !!m.is_admin },
  })
  if (fnErr) throw fnErr
  if (!data?.member) throw new Error(data?.error ?? 'create_failed')
  return data.member as Member
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) throw error
}

// ─── Invitation campaigns ────────────────────────────────────────

export async function fetchCampaigns(): Promise<InvitationCampaign[]> {
  const { data, error } = await supabase
    .from('invitation_campaigns')
    .select('id, name, password, expires_at, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createCampaign(c: { name: string; password: string; expires_at: string }): Promise<InvitationCampaign> {
  const { data, error } = await supabase
    .from('invitation_campaigns')
    .insert({ name: c.name, password: c.password, expires_at: c.expires_at })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('invitation_campaigns').delete().eq('id', id)
  if (error) throw error
}

// Public (unauthenticated) campaign details for the invite landing page.
export interface InviteInfo { name: string; expires_at: string; expired: boolean }
export async function fetchInviteInfo(campaignId: string): Promise<InviteInfo> {
  const { data, error } = await supabase.functions.invoke('redeem-invitation', {
    body: { action: 'info', campaign_id: campaignId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as InviteInfo
}

// Public (unauthenticated) redemption: validates password + expiry, creates the
// member. The caller then signs in via phone OTP.
export async function redeemInvitation(p: { campaignId: string; password: string; name: string; phone: string }): Promise<{ existing: boolean }> {
  const { data, error } = await supabase.functions.invoke('redeem-invitation', {
    body: { action: 'redeem', campaign_id: p.campaignId, password: p.password, name: p.name, phone: p.phone },
  })
  // Edge-function non-2xx responses surface as a FunctionsHttpError; pull the
  // server's error code out of the response body so callers can show a precise
  // message (expired / bad_password / …).
  if (error) {
    let code = 'redeem_failed'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        if (j?.error) code = j.error
      }
    } catch { /* keep generic code */ }
    throw new Error(code)
  }
  if (data?.error) throw new Error(data.error)
  return { existing: !!data?.existing }
}

// ─── Rounds ──────────────────────────────────────────────────────

interface RoundRow {
  id: string; label: string; deadline: string; deadline_iso: string
  status: Round['status']; vat_rate: number; admin_fee: number
}

export async function fetchRounds(): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, label, deadline, deadline_iso, status, vat_rate, admin_fee')
    .order('deadline_iso', { ascending: false })
  if (error) throw error
  return (data as RoundRow[] | null)?.map((r) => ({
    id: r.id, label: r.label, deadline: r.deadline, deadline_iso: r.deadline_iso,
    status: r.status, vat_rate: Number(r.vat_rate), admin_fee: Number(r.admin_fee),
  })) ?? []
}

export async function upsertRound(r: Round): Promise<void> {
  const { error } = await supabase.from('rounds').upsert({
    id: r.id, label: r.label, deadline: r.deadline, deadline_iso: r.deadline_iso,
    status: r.status, vat_rate: r.vat_rate, admin_fee: r.admin_fee,
  })
  if (error) throw error
}

export async function deleteRound(id: string): Promise<void> {
  const { error } = await supabase.from('rounds').delete().eq('id', id)
  if (error) throw error
}

// Open/close: atomic via two updates (RLS allows admin)
export async function setRoundStatus(id: string, status: Round['status']): Promise<void> {
  if (status === 'åpen') {
    // First close any existing open round
    const { error: e1 } = await supabase.from('rounds').update({ status: 'lukket' }).eq('status', 'åpen').neq('id', id)
    if (e1) throw e1
  }
  const { error } = await supabase.from('rounds').update({ status }).eq('id', id)
  if (error) throw error
}

// ─── Round coffees (catalog per round) ────────────────────────────

interface CoffeeRow {
  id: string; coffee_key: string; name: string; notes: string
  weight: string; price: number; sort_order: number
}

export async function fetchRoundCatalog(roundId: string): Promise<Coffee[]> {
  const { data, error } = await supabase
    .from('round_coffees')
    .select('id, coffee_key, name, notes, weight, price, sort_order')
    .eq('round_id', roundId)
    .order('sort_order')
  if (error) throw error
  return (data as CoffeeRow[] | null)?.map((c) => ({
    id: c.coffee_key, name: c.name, notes: c.notes, weight: c.weight, price: Number(c.price),
  })) ?? []
}

export async function fetchAllCatalogs(): Promise<Record<string, Coffee[]>> {
  const { data, error } = await supabase
    .from('round_coffees')
    .select('round_id, coffee_key, name, notes, weight, price, sort_order')
    .order('round_id').order('sort_order')
  if (error) throw error
  const out: Record<string, Coffee[]> = {}
  for (const row of (data ?? []) as (CoffeeRow & { round_id: string })[]) {
    if (!out[row.round_id]) out[row.round_id] = []
    out[row.round_id].push({
      id: row.coffee_key, name: row.name, notes: row.notes,
      weight: row.weight, price: Number(row.price),
    })
  }
  return out
}

export async function saveRoundCatalog(roundId: string, items: Coffee[]): Promise<void> {
  // Replace strategy: delete then insert. Small lists; OK for now.
  const { error: delErr } = await supabase.from('round_coffees').delete().eq('round_id', roundId)
  if (delErr) throw delErr
  if (items.length === 0) return
  const rows = items.map((c, i) => ({
    round_id: roundId, coffee_key: c.id, name: c.name, notes: c.notes,
    weight: c.weight, price: c.price, sort_order: i,
  }))
  const { error } = await supabase.from('round_coffees').insert(rows)
  if (error) throw error
}

// ─── Orders ──────────────────────────────────────────────────────

interface OrderRow {
  id: string; round_id: string; member_id: string
  locked: boolean; paid: boolean; placed_at: string | null
}

interface OrderItemRow {
  order_id: string; coffee_key: string; qty: number
}

// All orders for a round, joined with member info — for admin
export async function fetchRoundOrders(roundId: string): Promise<MemberOrder[]> {
  const { data: orders, error: e1 } = await supabase
    .from('orders')
    .select('id, round_id, member_id, locked, paid, placed_at, members!inner(name, email)')
    .eq('round_id', roundId)
    .eq('locked', true)
    .order('placed_at')
  if (e1) throw e1
  type Joined = OrderRow & { members: { name: string; email: string } }
  const orderRows = (orders ?? []) as unknown as Joined[]
  if (!orderRows.length) return []

  const orderIds = orderRows.map((o) => o.id)
  const { data: items, error: e2 } = await supabase
    .from('order_items')
    .select('order_id, coffee_key, qty')
    .in('order_id', orderIds)
  if (e2) throw e2

  const itemsByOrder: Record<string, Record<string, number>> = {}
  for (const it of (items ?? []) as OrderItemRow[]) {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = {}
    itemsByOrder[it.order_id][it.coffee_key] = it.qty
  }

  return orderRows.map((o) => ({
    id: o.id,
    member: o.members.name,
    email: o.members.email,
    placed_at: o.placed_at ? new Date(o.placed_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) : '',
    paid: o.paid,
    items: itemsByOrder[o.id] ?? {},
  }))
}

// The current member's order for a round (may not exist; may be unlocked draft)
export async function fetchMyOrder(roundId: string, memberId: string): Promise<{ id: string; locked: boolean; items: Record<string, number> } | null> {
  const { data: ord, error } = await supabase
    .from('orders')
    .select('id, locked')
    .eq('round_id', roundId)
    .eq('member_id', memberId)
    .maybeSingle()
  if (error) throw error
  if (!ord) return null

  const { data: items, error: e2 } = await supabase
    .from('order_items')
    .select('coffee_key, qty')
    .eq('order_id', ord.id)
  if (e2) throw e2

  const map: Record<string, number> = {}
  for (const it of (items ?? []) as { coffee_key: string; qty: number }[]) {
    map[it.coffee_key] = it.qty
  }
  return { id: ord.id, locked: ord.locked, items: map }
}

// The member's past (locked) orders across rounds — for history
export async function fetchMyPastOrders(memberId: string): Promise<PastOrder[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, round_id, locked, paid, placed_at, rounds!inner(label, deadline, status)')
    .eq('member_id', memberId)
    .eq('locked', true)
    .order('placed_at', { ascending: false })
  if (error) throw error
  type Joined = OrderRow & { rounds: { label: string; deadline: string; status: Round['status'] } }
  const ords = (orders ?? []) as unknown as Joined[]
  if (!ords.length) return []

  const ids = ords.map((o) => o.id)
  const { data: items, error: e2 } = await supabase
    .from('order_items').select('order_id, coffee_key, qty').in('order_id', ids)
  if (e2) throw e2
  const byOrder: Record<string, { id: string; qty: number }[]> = {}
  for (const it of (items ?? []) as OrderItemRow[]) {
    if (!byOrder[it.order_id]) byOrder[it.order_id] = []
    byOrder[it.order_id].push({ id: it.coffee_key, qty: it.qty })
  }

  return ords.map((o) => ({
    id: o.id,
    round_id: o.round_id,
    label: o.rounds.label,
    date: o.placed_at ? new Date(o.placed_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : o.rounds.deadline,
    status: o.rounds.status === 'lukket' ? 'Levert' : 'Låst',
    paid: o.paid,
    items: byOrder[o.id] ?? [],
  }))
}

// Upsert the member's cart for a round + replace items + set locked
export async function saveMyOrder(
  roundId: string, memberId: string, items: Record<string, number>, locked: boolean
): Promise<void> {
  const existing = await fetchMyOrder(roundId, memberId)
  let orderId: string

  if (existing) {
    orderId = existing.id
    const update: Record<string, unknown> = { locked }
    if (locked && !existing.locked) update.placed_at = new Date().toISOString()
    const { error } = await supabase.from('orders').update(update).eq('id', orderId)
    if (error) throw error
  } else {
    // Don't create an order row for an empty unlocked cart
    const hasItems = Object.values(items).some((q) => q > 0)
    if (!hasItems && !locked) return
    const { data, error } = await supabase
      .from('orders')
      .insert({ round_id: roundId, member_id: memberId, locked, placed_at: locked ? new Date().toISOString() : null })
      .select('id').single()
    if (error) throw error
    orderId = data.id
  }

  // Replace items
  const { error: delErr } = await supabase.from('order_items').delete().eq('order_id', orderId)
  if (delErr) throw delErr
  const rows = Object.entries(items).filter(([, qty]) => qty > 0).map(([coffee_key, qty]) => ({
    order_id: orderId, coffee_key, qty,
  }))
  if (rows.length) {
    const { error: insErr } = await supabase.from('order_items').insert(rows)
    if (insErr) throw insErr
  }
}

export async function setOrderPaid(orderId: string, paid: boolean): Promise<void> {
  const { error } = await supabase.from('orders').update({ paid }).eq('id', orderId)
  if (error) throw error
}

// Admin: delete an order entirely. RLS allows admin regardless of round status.
export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', orderId)
  if (error) throw error
}

// Admin: overwrite the items on an existing order (e.g. after a partial delivery).
// RLS allows admin to edit any order regardless of round status.
export async function saveOrderItems(orderId: string, items: Record<string, number>): Promise<void> {
  const { error: delErr } = await supabase.from('order_items').delete().eq('order_id', orderId)
  if (delErr) throw delErr
  const rows = Object.entries(items)
    .filter(([, qty]) => qty > 0)
    .map(([coffee_key, qty]) => ({ order_id: orderId, coffee_key, qty }))
  if (rows.length) {
    const { error } = await supabase.from('order_items').insert(rows)
    if (error) throw error
  }
}
