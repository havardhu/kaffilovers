import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import * as db from './lib/db'
import type { Coffee, Round, Member, Cart, PastOrder, MemberOrder, InvitationCampaign } from './lib/types'
import { load, save } from './lib/utils'
import LoginScreen from './components/LoginScreen'
import InviteScreen from './components/InviteScreen'
import CatalogScreen from './components/CatalogScreen'
import HistoryScreen from './components/HistoryScreen'
import AdminScreen from './components/AdminScreen'
import InfoScreen from './components/InfoScreen'
import AppHeader from './components/AppHeader'
import './styles.css'

type View = 'catalog' | 'history' | 'admin' | 'info'

export default function App() {
  // ── Auth ──
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)

  // ── UI ──
  const [view, setView] = useState<View>(() => load('view', 'catalog'))
  const [dark, setDark] = useState(() => load('dark', false))

  // ── Invitation link (?invite=<campaign-id>) ──
  const [inviteId, setInviteId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('invite'))
  const clearInvite = useCallback(() => {
    setInviteId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])

  // ── Data (loaded from Supabase) ──
  const [loading, setLoading] = useState(true)
  const [rounds, setRoundsState] = useState<Round[]>([])
  const [members, setMembersState] = useState<Member[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, Coffee[]>>({})
  const [ordersByRound, setOrdersByRound] = useState<Record<string, MemberOrder[]>>({})
  const [myPastOrders, setMyPastOrders] = useState<PastOrder[]>([])
  const [campaigns, setCampaigns] = useState<InvitationCampaign[]>([])

  // ── Cart (current round) ──
  const [cart, setCart] = useState<Cart>({})
  const [myOrderLocked, setMyOrderLocked] = useState(false)
  const [myOrderId, setMyOrderId] = useState<string | null>(null)
  const [catalogRoundId, setCatalogRoundId] = useState<string>('')

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setUserEmail(session?.user?.email ?? null)
      setUserPhone(session?.user?.phone ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
      setUserEmail(session?.user?.email ?? null)
      setUserPhone(session?.user?.phone ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Initial data load — once authenticated
  const reload = useCallback(async () => {
    if (!authed || (!userEmail && !userPhone)) return
    setLoading(true)
    try {
      const [me, rs, ms, cats] = await Promise.all([
        db.fetchCurrentMember({ email: userEmail, phone: userPhone }),
        db.fetchRounds(),
        db.fetchMembers(),
        db.fetchAllCatalogs(),
      ])
      setCurrentMember(me)
      setRoundsState(rs)
      setMembersState(ms)
      setCatalogs(cats)

      // Default to the open round in the catalog selector
      const active = rs.find((r) => r.status === 'åpen') ?? rs[0]
      if (active && !catalogRoundId) setCatalogRoundId(active.id)

      // My order for the open round
      if (active && me) {
        const mine = await db.fetchMyOrder(active.id, me.id)
        setMyOrderId(mine?.id ?? null)
        setCart(mine?.items ?? {})
        setMyOrderLocked(mine?.locked ?? false)
      }
      // My past orders (history)
      if (me) {
        const past = await db.fetchMyPastOrders(me.id)
        setMyPastOrders(past)
      }
      // If admin, prefetch orders for the open round for the admin view
      if (me?.is_admin && active) {
        const ords = await db.fetchRoundOrders(active.id)
        setOrdersByRound((m) => ({ ...m, [active.id]: ords }))
      }
      // If admin, load invitation campaigns
      if (me?.is_admin) {
        setCampaigns(await db.fetchCampaigns())
      }
    } catch (e) {
      console.error('[reload]', e)
    } finally {
      setLoading(false)
    }
  }, [authed, userEmail, userPhone, catalogRoundId])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => save('view', view), [view])
  useEffect(() => save('dark', dark), [dark])
  // An already-logged-in visitor who opens an invite link just sees the app.
  useEffect(() => { if (authed && inviteId) clearInvite() }, [authed, inviteId, clearInvite])

  // Lazy-load orders for a round when admin switches to it
  const ensureOrdersLoaded = useCallback(async (roundId: string) => {
    if (ordersByRound[roundId]) return
    try {
      const ords = await db.fetchRoundOrders(roundId)
      setOrdersByRound((m) => ({ ...m, [roundId]: ords }))
    } catch (e) { console.error('[load orders]', e) }
  }, [ordersByRound])

  // Force-refresh orders for a round (after admin edits)
  const reloadOrders = useCallback(async (roundId: string) => {
    try {
      const ords = await db.fetchRoundOrders(roundId)
      setOrdersByRound((m) => ({ ...m, [roundId]: ords }))
    } catch (e) { console.error('[reloadOrders]', e) }
  }, [])

  // Admin saves edits to a member's order line items
  const adminSaveOrderItems = useCallback(async (orderId: string, items: Record<string, number>, roundId: string) => {
    await db.saveOrderItems(orderId, items)
    await reloadOrders(roundId)
  }, [reloadOrders])

  // Admin deletes a member's order entirely
  const adminDeleteOrder = useCallback(async (orderId: string, roundId: string) => {
    await db.deleteOrder(orderId)
    await reloadOrders(roundId)
  }, [reloadOrders])

  // Admin toggles paid status on an order
  const adminTogglePaid = useCallback(async (orderId: string, paid: boolean, roundId: string) => {
    await db.setOrderPaid(orderId, paid)
    await reloadOrders(roundId)
  }, [reloadOrders])

  // ── Derived ──
  const activeRound = rounds.find((r) => r.status === 'åpen') ?? null
  const isAdmin = currentMember?.is_admin ?? false
  const catalogForRound = (id: string): Coffee[] => catalogs[id] ?? []
  const ordersForRound = (id: string): MemberOrder[] => ordersByRound[id] ?? []

  // ── Cart actions ──
  const setQty = (id: string, v: number) => {
    if (myOrderLocked) return
    setCart((c) => {
      const next = { ...c }
      if (v <= 0) delete next[id]; else next[id] = v
      return next
    })
  }

  const deleteMyOrder = async () => {
    if (!activeRound || !currentMember) return
    const existing = await db.fetchMyOrder(activeRound.id, currentMember.id)
    if (!existing) return
    await db.deleteOrder(existing.id)
    setCart({})
    setMyOrderId(null)
    setMyOrderLocked(false)
    setOrdersByRound((m) => { const n = { ...m }; delete n[activeRound.id]; return n })
  }

  const toggleLock = async () => {
    if (!activeRound || !currentMember) return
    const bags = Object.values(cart).reduce((a, b) => a + b, 0)
    const nextLocked = !myOrderLocked
    if (nextLocked && !bags) return
    try {
      await db.saveMyOrder(activeRound.id, currentMember.id, cart, nextLocked)
      if (!myOrderId) {
        const refreshed = await db.fetchMyOrder(activeRound.id, currentMember.id)
        setMyOrderId(refreshed?.id ?? null)
      }
      setMyOrderLocked(nextLocked)
      // refresh history if we just locked
      if (nextLocked) {
        const past = await db.fetchMyPastOrders(currentMember.id)
        setMyPastOrders(past)
        // invalidate admin orders cache so navigating to admin shows the new order
        setOrdersByRound((m) => { const n = { ...m }; delete n[activeRound.id]; return n })
      }
    } catch (e) {
      console.error('[lock]', e)
      alert('Kunne ikke lagre bestillingen. Prøv igjen.')
    }
    window.scrollTo({ top: 0 })
  }

  // Persist unlocked cart changes after debounce
  useEffect(() => {
    if (!activeRound || !currentMember || myOrderLocked || loading) return
    const t = setTimeout(() => {
      void db.saveMyOrder(activeRound.id, currentMember.id, cart, false).catch((e) => console.error('[cart save]', e))
    }, 600)
    return () => clearTimeout(t)
  }, [cart, activeRound, currentMember, myOrderLocked, loading])

  const goto = (v: View) => {
    if (v === 'catalog' && activeRound) setCatalogRoundId(activeRound.id)
    if (v === 'history' && currentMember) {
      db.fetchMyPastOrders(currentMember.id).then(setMyPastOrders).catch(console.error)
    }
    setView(v); window.scrollTo({ top: 0 })
  }
  const logout = async () => { await supabase.auth.signOut(); setCart({}); setView('catalog') }

  // ── Current locked order to show at top of history ──
  const currentOrder: PastOrder | null = (() => {
    if (!activeRound || !myOrderLocked) return null
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }))
    if (!items.length) return null
    return {
      id: activeRound.id,
      round_id: activeRound.id,
      label: activeRound.label,
      date: 'Frist ' + activeRound.deadline,
      status: 'Låst',
      paid: false,
      items,
    }
  })()

  // ── Admin write-throughs (refetch after mutation) ──
  const adminSetRounds = async (next: Round[]) => {
    setRoundsState(next)
    try {
      // upsert all changed (simple approach: upsert everything)
      for (const r of next) await db.upsertRound(r)
      // detect deletes
      const ids = new Set(next.map((r) => r.id))
      for (const r of rounds) if (!ids.has(r.id)) await db.deleteRound(r.id)
    } catch (e) { console.error('[adminSetRounds]', e); alert('Kunne ikke lagre runder.') }
  }

  const adminSetMembers = async (next: Member[]) => {
    setMembersState(next)
    try {
      const existingIds = new Set(members.map((m) => m.id))
      for (const m of next) {
        if (existingIds.has(m.id)) {
          await db.upsertMember(m)
        } else {
          // New member — strip temp client UUID so edge function assigns real DB UUID
          const { id: tempId, ...rest } = m
          const created = await db.upsertMember(rest)
          setMembersState((prev) => prev.map((x) => x.id === tempId ? created : x))
        }
      }
      const ids = new Set(next.map((m) => m.id))
      for (const m of members) if (!ids.has(m.id)) await db.deleteMember(m.id)
    } catch (e) { console.error('[adminSetMembers]', e); alert('Kunne ikke lagre medlemmer.') }
  }

  const adminCreateCampaign = useCallback(async (c: { name: string; password: string; expires_at: string }) => {
    const created = await db.createCampaign(c)
    setCampaigns((cs) => [created, ...cs])
  }, [])

  const adminDeleteCampaign = useCallback(async (id: string) => {
    await db.deleteCampaign(id)
    setCampaigns((cs) => cs.filter((c) => c.id !== id))
  }, [])

  const adminSaveCatalog = async (roundId: string, list: Coffee[]) => {
    setCatalogs((c) => ({ ...c, [roundId]: list }))
    try {
      await db.saveRoundCatalog(roundId, list)
    } catch (e) { console.error('[adminSaveCatalog]', e); alert('Kunne ikke lagre katalogen.') }
  }

  // ── Render ──

  if (authLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', color: 'var(--muted-foreground)', fontSize: 24 }}>☕</div>
  }

  if (!authed) {
    return (
      <div className={'k-app' + (dark ? ' dark' : '')}>
        {inviteId
          ? <InviteScreen campaignId={inviteId} onExit={clearInvite} />
          : <LoginScreen onLogin={() => { setAuthed(true); goto('catalog') }} />}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={'k-app' + (dark ? ' dark' : '')}>
        <main className="k-main" style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>
          Laster…
        </main>
      </div>
    )
  }

  // Member exists in auth but not in members table — shouldn't happen because of
  // the auth trigger, but guard anyway.
  if (!currentMember) {
    return (
      <div className={'k-app' + (dark ? ' dark' : '')}>
        <main className="k-main" style={{ textAlign: 'center', padding: 40 }}>
          <h2>Velkommen!</h2>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Kontoen din er logget inn ({userEmail ?? userPhone}), men du er ikke i medlemslisten ennå.
            Be administratoren legge deg til.
          </p>
          <button className="k-btn k-btn-ghost" style={{ marginTop: 16 }} onClick={logout}>Logg ut</button>
        </main>
      </div>
    )
  }

  if (view === 'admin' && isAdmin) {
    return (
      <div className={'k-app' + (dark ? ' dark' : '')}>
        <AdminScreen
          rounds={rounds} setRounds={adminSetRounds}
          members={members} setMembers={adminSetMembers}
          ordersForRound={ordersForRound}
          ensureOrdersLoaded={ensureOrdersLoaded}
          saveOrderItems={adminSaveOrderItems}
          deleteOrder={adminDeleteOrder}
          toggleOrderPaid={adminTogglePaid}
          catalogForRound={catalogForRound}
          saveCatalog={adminSaveCatalog}
          campaigns={campaigns}
          createCampaign={adminCreateCampaign}
          deleteCampaign={adminDeleteCampaign}
          onBack={() => goto('catalog')}
          dark={dark} onToggleDark={() => setDark((d) => !d)} onLogout={logout}
        />
      </div>
    )
  }

  return (
    <div className={'k-app' + (dark ? ' dark' : '')}>
      <AppHeader
        onLogoClick={() => goto('catalog')}
        nav={<>
          <button className={'k-nav-link' + (view === 'catalog' ? ' active' : '')} onClick={() => goto('catalog')}>Bestilling</button>
          <button className={'k-nav-link' + (view === 'history' ? ' active' : '')} onClick={() => goto('history')}>Mine bestillinger</button>
          <button className={'k-nav-link' + (view === 'info' ? ' active' : '')} onClick={() => goto('info')}>Info for geeks</button>
          {isAdmin && <button className={'k-nav-link' + (view === 'admin' ? ' active' : '')} onClick={() => goto('admin')}>Admin</button>}
        </>}
        dark={dark} onToggleDark={() => setDark((d) => !d)} onLogout={logout}
      />

      <main className="k-main">
        {view === 'info' ? (
          <InfoScreen />
        ) : view === 'history' ? (
          <HistoryScreen
            currentOrder={currentOrder}
            pastOrders={currentOrder ? myPastOrders.filter((o) => o.round_id !== activeRound?.id) : myPastOrders}
            getCatalog={catalogForRound}
            getRound={(id) => rounds.find((r) => r.id === id) ?? null}
          />
        ) : (
          <CatalogScreen
            cart={cart} setQty={setQty} layout="list" showLast lastOrderItems={(() => {
              // Use the most recent past order from history as "bestilte sist"
              const recent = myPastOrders[0]
              if (!recent) return {}
              const out: Record<string, number> = {}
              for (const it of recent.items) out[it.id] = it.qty
              return out
            })()}
            rounds={rounds} roundId={catalogRoundId || (activeRound?.id ?? rounds[0]?.id ?? '')}
            setRoundId={setCatalogRoundId}
            activeRoundId={activeRound?.id ?? null}
            locked={myOrderLocked} onToggleLock={toggleLock}
            hasExistingOrder={myOrderId !== null}
            onDeleteOrder={deleteMyOrder}
            catalogForRound={catalogForRound}
          />
        )}
      </main>

      <footer className="k-footer no-print">
        <span>CYBER Kaffi Lovers · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
