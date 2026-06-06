import { useState, useMemo, useEffect } from 'react'
import type { Coffee, Round, Member, MemberOrder } from '../lib/types'
import { ROUND_BADGE } from '../lib/types'
import { fmtPrice, fmtDeadline, priceBreakdown, initials } from '../lib/utils'
import { formatPhone, normalizePhone, isValidPhone } from '../lib/phone'
import { parseImport, slugify } from '../lib/import'
import { Card, CardContent, Badge, Button, Input, Label, Stepper } from './ui'
import {
  IconPlus, IconEdit, IconTrash, IconPrinter, IconCheck, IconClock,
  IconCalendar, IconChevronDown, IconPhone, IconMail, IconBack,
  IconLock, IconRepeat, IconUsers, IconReceipt,
} from './icons'

// ── helpers ──────────────────────────────────────────────────────

function nameById(catalog: Coffee[], id: string) { return catalog.find((c) => c.id === id)?.name ?? '(utgått kaffe)' }
function priceById(catalog: Coffee[], id: string) { return catalog.find((c) => c.id === id)?.price ?? 0 }

function aggregate(orders: MemberOrder[], catalog: Coffee[]) {
  const map: Record<string, number> = {}
  orders.forEach((o) => {
    Object.entries(o.items).forEach(([id, qty]) => { map[id] = (map[id] ?? 0) + qty })
  })
  return Object.entries(map)
    .map(([id, qty]) => ({ id, name: nameById(catalog, id), qty, price: priceById(catalog, id), sum: qty * priceById(catalog, id) }))
    .sort((a, b) => b.qty - a.qty)
}

function memberBags(o: MemberOrder) {
  return Object.values(o.items).reduce((a, b) => a + b, 0)
}

// ── RoundSwitcher ─────────────────────────────────────────────────

function RoundSwitcher({ rounds, roundId, setRoundId }: { rounds: Round[]; roundId: string; setRoundId: (id: string) => void }) {
  return (
    <div className="k-select-wrap">
      <select className="k-select" value={roundId} onChange={(e) => setRoundId(e.target.value)}>
        {rounds.map((r) => (
          <option key={r.id} value={r.id}>{r.label} — {(ROUND_BADGE[r.status] ?? ROUND_BADGE['planlagt']).label}</option>
        ))}
      </select>
      <IconChevronDown size={16} />
    </div>
  )
}

// ── MemberCard (orders view) ──────────────────────────────────────

function MemberCard({ order, catalog, round, paid, onTogglePaid, onSaveItems, onDelete }: {
  order: MemberOrder; catalog: Coffee[]; round: Round | null; paid: boolean
  onTogglePaid: () => void
  onSaveItems: (orderId: string, items: Record<string, number>) => Promise<void>
  onDelete: (orderId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, number>>(order.items)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Slette ${order.member} sin bestilling? Dette kan ikke angres.`)) return
    setDeleting(true)
    try { await onDelete(order.id) }
    catch (e) { console.error('[deleteOrder]', e); alert('Kunne ikke slette bestillingen.'); setDeleting(false) }
  }

  // Reset local draft whenever the order itself reloads from the server.
  useEffect(() => { setDraft(order.items); setEditing(false) }, [order.items])

  const bags = memberBags(order)
  const bd = priceBreakdown(order.items, catalog, round)

  const startEdit = () => { setDraft({ ...order.items }); setEditing(true); setOpen(true) }
  const cancelEdit = () => { setDraft({ ...order.items }); setEditing(false) }
  const saveEdit = async () => {
    setSaving(true)
    try {
      await onSaveItems(order.id, draft)
      setEditing(false)
    } catch (e) {
      console.error('[saveOrderItems]', e)
      alert('Kunne ikke lagre endringene.')
    } finally {
      setSaving(false)
    }
  }
  const setQty = (id: string, v: number) => {
    setDraft((d) => {
      const next = { ...d }
      if (v <= 0) delete next[id]; else next[id] = v
      return next
    })
  }

  const draftBags = Object.values(draft).reduce((a, b) => a + b, 0)
  const draftBd = priceBreakdown(draft, catalog, round)
  const changed = JSON.stringify(draft) !== JSON.stringify(order.items)

  return (
    <Card className={'k-member-card' + (paid ? ' is-paid' : '')}>
      <button className="k-member-head" onClick={() => setOpen((o) => !o)}>
        <div className="k-avatar">{initials(order.member)}</div>
        <div className="k-member-meta">
          <span className="k-member-name">{order.member}</span>
          <span className="k-member-sub">{bags} {bags === 1 ? 'pose' : 'poser'} · bestilte {order.placed_at}</span>
        </div>
        <span
          className={'k-pay-toggle' + (paid ? ' paid' : '')}
          role="button" tabIndex={0}
          title={paid ? 'Merk som ikke betalt' : 'Merk som betalt'}
          onClick={(e) => { e.stopPropagation(); onTogglePaid() }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTogglePaid() } }}
        >
          {paid ? <><IconCheck size={13} /> Betalt</> : <><IconClock size={13} /> Ikke betalt</>}
        </span>
        <span className="k-member-tot">{fmtPrice(bd.total)}</span>
        <span className={'k-chev' + (open ? ' open' : '')}><IconBack size={16} style={{ transform: 'rotate(-90deg)' }} /></span>
      </button>

      {open && !editing && (
        <div className="k-member-body">
          {Object.entries(order.items).length === 0 && (
            <p style={{ margin: '4px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>Bestillingen er tom.</p>
          )}
          {Object.entries(order.items).map(([id, qty]) => (
            <div key={id} className="k-member-line">
              <span className="k-receipt-qty">{qty}×</span>
              <span className="k-receipt-name">{nameById(catalog, id)}</span>
              <span className="k-receipt-sum">{fmtPrice(qty * priceById(catalog, id))}</span>
            </div>
          ))}
          {(bd.gebyr > 0 || bd.mva > 0) && (
            <div className="k-member-breakdown">
              <div className="k-member-line k-bd-line"><span className="k-bd-label">Varesum</span><span className="k-receipt-sum">{fmtPrice(bd.varesum)}</span></div>
              {bd.gebyr > 0 && <div className="k-member-line k-bd-line"><span className="k-bd-label">Adm.gebyr ({fmtPrice(bd.adminFee)} × {bd.bags})</span><span className="k-receipt-sum">{fmtPrice(bd.gebyr)}</span></div>}
              <div className="k-member-line k-bd-line k-bd-total"><span className="k-bd-label">Å betale</span><span className="k-receipt-sum">{fmtPrice(bd.total)}</span></div>
              {bd.mva > 0 && <div className="k-member-line k-bd-line"><span className="k-bd-label">Herav mva ({bd.vatRate} %)</span><span className="k-receipt-sum">{fmtPrice(bd.mva)}</span></div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}
              style={{ color: 'var(--destructive)' }}>
              <IconTrash size={14} /> {deleting ? 'Sletter…' : 'Slett bestilling'}
            </Button>
            <Button variant="outline" size="sm" onClick={startEdit}>
              <IconEdit size={14} /> Rediger bestilling
            </Button>
          </div>
        </div>
      )}

      {open && editing && (
        <div className="k-member-body">
          <p className="k-section-label" style={{ marginBottom: 8 }}>Juster antall poser</p>
          {catalog.map((c) => {
            const qty = draft[c.id] ?? 0
            const had = order.items[c.id] ?? 0
            return (
              <div key={c.id} className="k-member-line" style={{ gap: 10 }}>
                <span className="k-receipt-name" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{c.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                    {fmtPrice(c.price)} eks. mva
                    {had > 0 && had !== qty && <> · opprinnelig {had}</>}
                  </span>
                </span>
                <Stepper value={qty} onChange={(v) => setQty(c.id, v)} size="sm" />
              </div>
            )
          })}
          <div className="k-member-breakdown">
            <div className="k-member-line k-bd-line">
              <span className="k-bd-label">{draftBags} {draftBags === 1 ? 'pose' : 'poser'} totalt</span>
              <span className="k-receipt-sum">{fmtPrice(draftBd.total)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Avbryt</Button>
            <Button size="sm" onClick={saveEdit} disabled={saving || !changed}>
              {saving ? 'Lagrer…' : 'Lagre endringer'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── OrdersView ────────────────────────────────────────────────────

function OrdersView({ rounds, roundId, setRoundId, members, ordersForRound, catalogForRound, onGoRounds, onPrint, saveOrderItems, deleteOrder, toggleOrderPaid }: {
  rounds: Round[]; roundId: string; setRoundId: (id: string) => void; members: Member[]
  ordersForRound: (id: string) => MemberOrder[]; catalogForRound: (id: string) => Coffee[]
  onGoRounds: () => void; onPrint: (mode: string) => void
  saveOrderItems: (orderId: string, items: Record<string, number>, roundId: string) => Promise<void>
  deleteOrder: (orderId: string, roundId: string) => Promise<void>
  toggleOrderPaid: (orderId: string, paid: boolean, roundId: string) => Promise<void>
}) {
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0]
  const orders = round ? ordersForRound(round.id) : []
  const catalog = round ? catalogForRound(round.id) : []
  const agg = useMemo(() => aggregate(orders, catalog), [orders, catalog])
  const totalBags = agg.reduce((a, b) => a + b.qty, 0)
  const varesumKr = agg.reduce((a, b) => a + b.sum, 0)
  const grandTotal = orders.reduce((a, o) => a + priceBreakdown(o.items, catalog, round ?? null).total, 0)
  const ordered = orders.map((o) => o.member)
  const missing = members.filter((m) => !ordered.includes(m.name))

  const paidCount = orders.filter((o) => o.paid).length

  if (!round) {
    return (
      <div className="k-page">
        <div className="k-page-head"><div><h1 className="k-page-title">Bestillinger</h1><p className="k-page-sub">Ingen runder ennå</p></div></div>
        <Card><CardContent style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📦</div>
          <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Ingen runder</p>
          <Button onClick={onGoRounds}><IconCalendar size={16} /> Gå til runder</Button>
        </CardContent></Card>
      </div>
    )
  }

  const statusBadge = ROUND_BADGE[round.status] ?? ROUND_BADGE['planlagt']

  return (
    <div className="k-page">
      <div className="k-page-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="k-page-title">Bestillinger</h1>
          <div className="k-round-switch">
            <RoundSwitcher rounds={rounds} roundId={round.id} setRoundId={setRoundId} />
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <span className="k-page-sub">frist {round.deadline}</span>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card><CardContent style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>☕</div>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Ingen bestillinger ennå</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
            {round.status === 'planlagt' ? 'Denne runden er ikke åpnet for bestilling ennå.' : 'Ingen medlemmer har bestilt i denne runden.'}
          </p>
        </CardContent></Card>
      ) : (
        <>
          <div className="k-admin-summary">
            <div className="k-stat"><div className="k-stat-num">{orders.length}<span style={{ fontSize: 15, color: 'var(--muted-foreground)', fontWeight: 500 }}> / {members.length}</span></div><div className="k-stat-label">medlemmer har bestilt</div></div>
            <div className="k-stat"><div className="k-stat-num">{totalBags}</div><div className="k-stat-label">poser totalt</div></div>
            <div className="k-stat"><div className="k-stat-num accent">{fmtPrice(grandTotal)}</div><div className="k-stat-label">å kreve inn (inkl. mva{round.admin_fee ? ' og gebyr' : ''})</div></div>
            <div className="k-stat"><div className="k-stat-num">{paidCount}<span style={{ fontSize: 15, color: 'var(--muted-foreground)', fontWeight: 500 }}> / {orders.length}</span></div><div className="k-stat-label">har betalt</div></div>
          </div>

          <div className="k-admin-bar">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="k-section-label">Samlebestilling til Supreme Roastworks</p>
              <p className="k-page-sub" style={{ marginTop: 2 }}>Priser eks. mva — som faktureres fra roasteren.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => onPrint('totals')}><IconPrinter size={15} /> Samlebestilling</Button>
              <Button variant="outline" size="sm" onClick={() => onPrint('handout')}><IconPrinter size={15} /> Utleveringsliste</Button>
            </div>
          </div>

          <Card>
            <div style={{ padding: '14px 4px 6px' }}>
              <table className="k-table">
                <thead><tr><th>Kaffe</th><th className="num">Antall</th><th className="num">Sum</th></tr></thead>
                <tbody>
                  {agg.map((r) => (
                    <tr key={r.id}>
                      <td className="k-agg-name">{r.name}</td>
                      <td className="num"><span className="k-agg-qty">{r.qty}</span></td>
                      <td className="num">{fmtPrice(r.sum)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Varesum · {totalBags} poser</td>
                    <td className="num"></td>
                    <td className="num">{fmtPrice(varesumKr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <p className="k-section-label" style={{ marginTop: 4 }}>Per medlem</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map((o) => (
              <MemberCard key={o.id} order={o} catalog={catalog} round={round ?? null}
                paid={o.paid} onTogglePaid={() => toggleOrderPaid(o.id, !o.paid, round.id)}
                onSaveItems={(orderId, items) => saveOrderItems(orderId, items, round.id)}
                onDelete={(orderId) => deleteOrder(orderId, round.id)} />
            ))}
          </div>

          {missing.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="k-section-label">Mangler bestilling ({missing.length})</p>
              <div className="k-missing">
                {missing.map((m) => <span key={m.id} className="k-missing-chip">{m.name}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── CatalogManager ────────────────────────────────────────────────

const blankCoffee = (): Coffee => ({ id: 'new-' + Date.now(), name: '', notes: '', weight: '1000 g', price: 0 })

function EditForm({ draft, onChange, onSave, onCancel }: {
  draft: Coffee; onChange: (c: Coffee) => void; onSave: () => void; onCancel: () => void
}) {
  const valid = draft.name.trim() && String(draft.price).trim()
  return (
    <div className="k-edit-form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Navn (opprinnelse, produsent, prosess)</Label>
        <Input value={draft.name} placeholder="Land, produsent, region, prosess (B)" onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Smaksbeskrivelse</Label>
        <Input value={draft.notes} placeholder="Smaksnoter, kropp, syre…" onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </div>
      <div className="k-edit-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Vekt</Label>
          <Input value={draft.weight} onChange={(e) => onChange({ ...draft, weight: e.target.value })} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Pris eks. mva (kr)</Label>
          <Input type="number" value={draft.price || ''} onChange={(e) => onChange({ ...draft, price: Number(e.target.value) })} />
          <span className="k-field-hint">Medlemmene ser pris inkl. mva.</span>
        </div>
      </div>
      <div className="k-edit-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button size="sm" disabled={!valid} onClick={onSave}>Lagre</Button>
      </div>
    </div>
  )
}

function CatalogManager({ rounds, roundId, setRoundId, catalogForRound, saveCatalog }: {
  rounds: Round[]; roundId: string; setRoundId: (id: string) => void
  catalogForRound: (id: string) => Coffee[]; saveCatalog: (id: string, list: Coffee[]) => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Coffee | null>(null)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importReplace, setImportReplace] = useState(false)
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0]
  const catalog = catalogForRound(round?.id ?? '')

  const startAdd = () => { const c = blankCoffee(); setDraft(c); setEditId(c.id) }
  const startEdit = (c: Coffee) => { setDraft({ ...c }); setEditId(c.id) }
  const cancel = () => { setEditId(null); setDraft(null) }
  const changeRound = (id: string) => { cancel(); setRoundId(id); setImporting(false); setImportText(''); setImportReplace(false) }

  const parsedImport = useMemo(() => parseImport(importText), [importText])
  const importPreview = useMemo(() => {
    return parsedImport.map((p) => {
      const id = slugify(p.name)
      const existing = catalog.find((c) => c.id === id)
      return {
        id, name: p.name, notes: p.notes, price: p.price,
        action: existing ? 'oppdater' as const : 'ny' as const,
        previousPrice: existing?.price,
      }
    })
  }, [parsedImport, catalog])

  // In replace mode, anything in the current catalog that isn't in the
  // import gets removed.
  const importDropped = useMemo(() => {
    if (!importReplace) return []
    const incomingIds = new Set(parsedImport.map((p) => slugify(p.name)))
    return catalog.filter((c) => !incomingIds.has(c.id))
  }, [importReplace, parsedImport, catalog])

  const applyImport = () => {
    if (importReplace && catalog.length > 0) {
      const ok = window.confirm(
        `Erstatte hele katalogen for ${round.label}? ` +
        `${catalog.length} ${catalog.length === 1 ? 'kaffe' : 'kaffer'} fjernes og ` +
        `${parsedImport.length} ${parsedImport.length === 1 ? 'kaffe' : 'kaffer'} legges inn.`
      )
      if (!ok) return
    }
    const base = importReplace ? [] : [...catalog]
    for (const p of parsedImport) {
      const id = slugify(p.name)
      const coffee: Coffee = { id, name: p.name, notes: p.notes, weight: '1000 g', price: p.price }
      const idx = base.findIndex((c) => c.id === id)
      if (idx >= 0) base[idx] = coffee
      else base.push(coffee)
    }
    saveCatalog(round.id, base)
    setImporting(false)
    setImportText('')
    setImportReplace(false)
  }

  const saveDraft = () => {
    if (!draft) return
    const clean = { ...draft, price: Number(draft.price) || 0, name: draft.name.trim(), notes: draft.notes.trim() }
    const exists = catalog.some((c) => c.id === clean.id)
    const next = exists ? catalog.map((c) => (c.id === clean.id ? clean : c)) : [...catalog, clean]
    saveCatalog(round.id, next)
    cancel()
  }

  const remove = (id: string) => {
    if (window.confirm('Fjerne denne kaffen fra katalogen?')) {
      saveCatalog(round.id, catalog.filter((c) => c.id !== id))
    }
  }

  if (!round) return null

  return (
    <div className="k-page">
      <div className="k-admin-bar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="k-page-title">Katalog</h1>
          <div className="k-round-switch">
            <RoundSwitcher rounds={rounds} roundId={round.id} setRoundId={changeRound} />
            <span className="k-page-sub">{catalog.length} {catalog.length === 1 ? 'kaffe' : 'kaffer'} i denne runden</span>
          </div>
        </div>
        {editId === null && !importing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={() => setImporting(true)}>Importer fra liste</Button>
            <Button onClick={startAdd}><IconPlus size={16} /> Legg til kaffe</Button>
          </div>
        )}
      </div>

      {importing && (
        <Card>
          <div className="k-edit-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Lim inn prislisten fra roasteren</Label>
              <span className="k-field-hint">
                Én kaffe per blokk: navn + pris på første linje, smaksnoter på linjene under.
                Eksempel: <em>"Brasil, Rosimeire, natural (B) 320,-"</em>. Rabatterte varer
                som <em>"-25% 395,- 296,-"</em> tolkes som pris <strong>296</strong>.
                Pris er <strong>eks. mva</strong>.
              </span>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                placeholder={'Brasil, Rosimeire, Mantiqueira, natural (B) 320,-\nSoft and fruity. Red fruit, plum and brown sugar.\nSweet and round.'}
                style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 13, padding: 10,
                  borderRadius: 7, border: '1px solid var(--input)', background: 'var(--background)',
                  color: 'var(--foreground)', resize: 'vertical', minHeight: 180,
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={importReplace}
                onChange={(e) => setImportReplace(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>Erstatt katalogen</strong> — fjern alle eksisterende kaffer for {round.label} som
                ikke er med i importen.
                <span className="k-field-hint" style={{ display: 'block', marginTop: 2 }}>
                  Lar du dette stå av, blir importen flettet inn (oppdaterer pris/notater på matchende
                  navn, legger til nye).
                </span>
              </span>
            </label>

            {importPreview.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p className="k-section-label">Forhåndsvisning · {importPreview.length} {importPreview.length === 1 ? 'kaffe' : 'kaffer'}</p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                  {importPreview.map((p, i) => (
                    <div key={i} className="k-cat-row" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                      <div className="k-cat-main">
                        <span className="k-item-name">
                          {p.name}{' '}
                          <Badge variant={p.action === 'ny' ? 'safe' : 'warn'}>
                            {p.action === 'ny' ? 'Ny' : `Oppdater · var ${fmtPrice(p.previousPrice ?? 0)}`}
                          </Badge>
                        </span>
                        <p className="k-item-notes">{p.notes || <em>(ingen smaksnoter)</em>}</p>
                      </div>
                      <div className="k-cat-aside">
                        <div className="k-cat-price">{fmtPrice(p.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importDropped.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p className="k-section-label" style={{ color: 'var(--destructive)' }}>
                  Blir fjernet · {importDropped.length} {importDropped.length === 1 ? 'kaffe' : 'kaffer'}
                </p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                  {importDropped.map((c, i) => (
                    <div key={c.id} className="k-cat-row" style={{ borderTop: i === 0 ? 'none' : undefined, opacity: 0.7 }}>
                      <div className="k-cat-main">
                        <span className="k-item-name" style={{ textDecoration: 'line-through' }}>{c.name}</span>
                      </div>
                      <div className="k-cat-aside">
                        <div className="k-cat-price" style={{ textDecoration: 'line-through' }}>{fmtPrice(c.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="k-edit-actions">
              <Button variant="ghost" size="sm" onClick={() => { setImporting(false); setImportText(''); setImportReplace(false) }}>
                Avbryt
              </Button>
              <Button size="sm" disabled={importPreview.length === 0} onClick={applyImport}>
                {importReplace ? 'Erstatt katalogen' : `Importer ${importPreview.length > 0 ? `${importPreview.length} ${importPreview.length === 1 ? 'kaffe' : 'kaffer'}` : ''}`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {editId && draft && !catalog.some((c) => c.id === editId) && (
        <Card><EditForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} /></Card>
      )}

      <Card style={{ overflow: 'hidden' }}>
        {catalog.length === 0 && (
          <div className="k-empty"><div className="k-empty-emoji">☕</div>Ingen kaffer ennå.</div>
        )}
        {catalog.map((c) => (
          <div key={c.id}>
            {editId === c.id && draft ? (
              <EditForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} />
            ) : (
              <div className="k-cat-row">
                <div className="k-cat-main">
                  <span className="k-item-name">{c.name}</span>
                  <p className="k-item-notes">{c.notes}</p>
                </div>
                <div className="k-cat-aside">
                  <div style={{ textAlign: 'right' }}>
                    <div className="k-cat-price">{fmtPrice(c.price)}</div>
                    <div className="k-weight">{c.weight}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="k-iconbtn" title="Rediger" onClick={() => startEdit(c)}><IconEdit size={15} /></button>
                    <button className="k-iconbtn danger" title="Fjern" onClick={() => remove(c.id)}><IconTrash size={15} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── RoundsManager ─────────────────────────────────────────────────

type RoundDraft = Round & { copyFrom?: string }
const blankRound = (): RoundDraft => ({ id: crypto.randomUUID(), label: '', deadline: '', deadline_iso: '', status: 'planlagt', vat_rate: 15, admin_fee: 10 })

function RoundForm({ draft, onChange, onSave, onCancel, isNew, rounds, catalogForRound }: {
  draft: RoundDraft; onChange: (r: RoundDraft) => void; onSave: () => void; onCancel: () => void
  isNew?: boolean; rounds: Round[]; catalogForRound: (id: string) => Coffee[]
}) {
  const valid = draft.label.trim() && draft.deadline_iso
  return (
    <div className="k-edit-form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Navn på runden</Label>
        <Input value={draft.label} placeholder="f.eks. August-runden" onChange={(e) => onChange({ ...draft, label: e.target.value })} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Frist for bestilling</Label>
        <Input type="date" value={(draft.deadline_iso || '').slice(0, 10)}
          onChange={(e) => onChange({ ...draft, deadline_iso: e.target.value })} />
        {draft.deadline_iso && <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Vises som «frist {fmtDeadline(draft.deadline_iso)}»</span>}
      </div>
      <div className="k-edit-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>MVA-sats (%)</Label>
          <Input type="number" min="0" step="1" value={draft.vat_rate ?? ''} placeholder="15"
            onChange={(e) => onChange({ ...draft, vat_rate: e.target.value === '' ? 0 : Number(e.target.value) })} />
          <span className="k-field-hint">Matvarer i Norge: 15 %</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Gebyr pr. pose (kr)</Label>
          <Input type="number" min="0" step="1" value={draft.admin_fee ?? ''} placeholder="10"
            onChange={(e) => onChange({ ...draft, admin_fee: e.target.value === '' ? 0 : Number(e.target.value) })} />
          <span className="k-field-hint">Legges til pr. pose.</span>
        </div>
      </div>
      {isNew && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Kopier utvalg fra</Label>
          <div className="k-select-wrap" style={{ width: '100%' }}>
            <select className="k-select" style={{ width: '100%' }} value={draft.copyFrom ?? '__default__'}
              onChange={(e) => onChange({ ...draft, copyFrom: e.target.value })}>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({catalogForRound(r.id).length} kaffer)</option>
              ))}
              <option value="__empty__">Tomt utvalg</option>
            </select>
            <IconChevronDown size={16} />
          </div>
        </div>
      )}
      <div className="k-edit-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button size="sm" disabled={!valid} onClick={onSave}>{isNew ? 'Opprett runde' : 'Lagre'}</Button>
      </div>
    </div>
  )
}

function RoundCard({ round, orderCount, onOpen, onClose, onEdit, onDelete }: {
  round: Round; orderCount: number
  onOpen: (id: string) => void; onClose: (id: string) => void
  onEdit: (r: Round) => void; onDelete: (id: string) => void
}) {
  const b = ROUND_BADGE[round.status] ?? ROUND_BADGE['planlagt']
  const isOpen = round.status === 'åpen'
  return (
    <Card className={'k-round-card' + (isOpen ? ' is-open' : '')}>
      <div className="k-round-mark"><IconCalendar size={18} color="var(--primary)" /></div>
      <div className="k-round-main">
        <div className="k-round-title-row">
          <span className="k-round-name">{round.label}</span>
          <Badge variant={b.variant}>{b.label}</Badge>
        </div>
        <div className="k-round-facts">
          <span className="k-round-fact"><IconClock size={14} /> Frist <strong>{round.deadline}</strong></span>
          <span className="k-round-fact"><IconReceipt size={14} /> {round.vat_rate ? round.vat_rate + ' % mva' : 'uten mva'}{round.admin_fee ? ' · ' + round.admin_fee + ' kr/pose gebyr' : ''}</span>
        </div>
        {orderCount > 0 && (
          <p className="k-round-orders-note"><IconUsers size={13} /> {orderCount} {orderCount === 1 ? 'medlem' : 'medlemmer'} {isOpen ? 'har bestilt så langt' : 'bestilte'}</p>
        )}
        <div className="k-round-actions">
          {round.status === 'planlagt' && (
            <>
              <Button size="sm" onClick={() => onOpen(round.id)}><IconCheck size={15} /> Åpne for bestilling</Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(round)}><IconEdit size={14} /> Rediger</Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(round.id)}><IconTrash size={14} /> Slett</Button>
            </>
          )}
          {round.status === 'åpen' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onClose(round.id)}><IconLock size={14} /> Lukk runden</Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(round)}><IconEdit size={14} /> Rediger</Button>
            </>
          )}
          {round.status === 'lukket' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onOpen(round.id)}><IconRepeat size={14} /> Åpne igjen</Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(round.id)}><IconTrash size={14} /> Slett</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function RoundsManager({ rounds, setRounds, ordersForRound, catalogForRound, saveCatalog }: {
  rounds: Round[]; setRounds: (r: Round[]) => void
  ordersForRound: (id: string) => MemberOrder[]
  catalogForRound: (id: string) => Coffee[]; saveCatalog: (id: string, list: Coffee[]) => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoundDraft | null>(null)

  const startAdd = () => {
    const r = blankRound()
    r.copyFrom = (rounds.find((x) => x.status === 'åpen') ?? rounds[0])?.id ?? '__default__'
    setDraft(r); setEditId(r.id)
  }
  const startEdit = (r: Round) => { setDraft({ ...r }); setEditId(r.id) }
  const cancel = () => { setEditId(null); setDraft(null) }

  const saveDraft = () => {
    if (!draft) return
    const clean: Round = {
      ...draft,
      label: draft.label.trim(),
      deadline: fmtDeadline(draft.deadline_iso),
      vat_rate: Number(draft.vat_rate) || 0,
      admin_fee: Number(draft.admin_fee) || 0,
    }
    const exists = rounds.some((r) => r.id === clean.id)
    if (!exists) {
      const src = draft.copyFrom
      let list: Coffee[]
      if (src === '__empty__' || src == undefined) list = []
      else list = catalogForRound(src).map((c) => ({ ...c }))
      saveCatalog(clean.id, list)
    }
    const next = exists ? rounds.map((r) => (r.id === clean.id ? clean : r)) : [...rounds, clean]
    setRounds(next); cancel()
  }

  const openRound = (id: string) => {
    if (!window.confirm('Åpne denne runden for bestilling? En eventuell åpen runde lukkes.')) return
    setRounds(rounds.map((r) => r.id === id ? { ...r, status: 'åpen' } : (r.status === 'åpen' ? { ...r, status: 'lukket' } : r)))
  }
  const closeRound = (id: string) => {
    if (!window.confirm('Lukke runden? Medlemmer kan ikke lenger sende inn bestillinger.')) return
    setRounds(rounds.map((r) => (r.id === id ? { ...r, status: 'lukket' } : r)))
  }
  const deleteRound = (id: string) => {
    if (window.confirm('Slette denne runden?')) setRounds(rounds.filter((r) => r.id !== id))
  }

  const isNew = editId && !rounds.some((r) => r.id === editId)
  const order: Record<string, number> = { 'åpen': 0, 'planlagt': 1, 'lukket': 2 }
  const sorted = [...rounds].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))

  return (
    <div className="k-page">
      <div className="k-admin-bar">
        <div><h1 className="k-page-title">Runder</h1><p className="k-page-sub">Opprett og styr bestillingsrunder</p></div>
        {editId === null && <Button onClick={startAdd}><IconPlus size={16} /> Ny runde</Button>}
      </div>

      {isNew && draft && (
        <Card><RoundForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} isNew rounds={rounds} catalogForRound={catalogForRound} /></Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((r) =>
          editId === r.id && draft ? (
            <Card key={r.id}><RoundForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} rounds={rounds} catalogForRound={catalogForRound} /></Card>
          ) : (
            <RoundCard key={r.id} round={r} orderCount={ordersForRound(r.id).length}
              onOpen={openRound} onClose={closeRound} onEdit={startEdit} onDelete={deleteRound} />
          )
        )}
        {sorted.length === 0 && (
          <Card><div className="k-empty"><div className="k-empty-emoji">📅</div>Ingen runder ennå.</div></Card>
        )}
      </div>
    </div>
  )
}

// ── MembersManager ────────────────────────────────────────────────

const blankMember = (): Member => ({ id: crypto.randomUUID(), name: '', email: '', phone: '', is_admin: false })
function isEmail(s: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim()) }

function MemberForm({ draft, onChange, onSave, onCancel, isNew }: {
  draft: Member; onChange: (m: Member) => void; onSave: () => void; onCancel: () => void; isNew: boolean
}) {
  const nameOk = draft.name.trim().length > 1
  const emailOk = isEmail(draft.email)
  const phoneOk = isValidPhone(draft.phone)
  const valid = nameOk && emailOk && phoneOk
  // Show the display-formatted phone, but normalize on commit (blur or save)
  const phoneShown = formatPhone(draft.phone) === draft.phone || /\s/.test(draft.phone)
    ? draft.phone : formatPhone(draft.phone)
  return (
    <div className="k-edit-form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Navn</Label>
        <Input value={draft.name} placeholder="f.eks. Kari Solbakken" onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>E-post</Label>
        <Input type="email" value={draft.email} placeholder="kari@example.no" onChange={(e) => onChange({ ...draft, email: e.target.value })} />
        {draft.email && !emailOk && <span className="k-field-hint danger">Ugyldig e-postadresse</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Telefon</Label>
        <Input type="tel" inputMode="tel" value={phoneShown} placeholder="934 12 087"
          onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          onBlur={() => onChange({ ...draft, phone: normalizePhone(draft.phone) })} />
        <span className="k-field-hint">Brukes til innlogging (SMS) og Vipps-betaling.</span>
        {draft.phone && !phoneOk && <span className="k-field-hint danger">Ugyldig telefonnummer.</span>}
      </div>
      <div className="k-edit-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button size="sm" disabled={!valid} onClick={onSave}>{isNew ? 'Legg til medlem' : 'Lagre'}</Button>
      </div>
    </div>
  )
}

function MembersManager({ members, setMembers }: { members: Member[]; setMembers: (m: Member[]) => void }) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Member | null>(null)

  const startAdd = () => { const m = blankMember(); setDraft(m); setEditId(m.id) }
  const startEdit = (m: Member) => { setDraft({ ...m }); setEditId(m.id) }
  const cancel = () => { setEditId(null); setDraft(null) }

  const saveDraft = () => {
    if (!draft) return
    const clean = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() }
    const exists = members.some((m) => m.id === clean.id)
    setMembers(exists ? members.map((m) => (m.id === clean.id ? clean : m)) : [...members, clean])
    cancel()
  }
  const remove = (m: Member) => {
    if (window.confirm('Fjerne ' + m.name + ' fra medlemslisten?')) {
      setMembers(members.filter((x) => x.id !== m.id))
      if (editId === m.id) cancel()
    }
  }

  return (
    <div className="k-page">
      <div className="k-admin-bar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="k-page-title">Medlemmer</h1>
          <p className="k-page-sub">{members.length} {members.length === 1 ? 'registrert medlem' : 'registrerte medlemmer'}</p>
        </div>
        {editId === null && <Button onClick={startAdd}><IconPlus size={16} /> Legg til medlem</Button>}
      </div>

      {editId && draft && !members.some((m) => m.id === editId) && (
        <Card><MemberForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} isNew /></Card>
      )}

      <Card style={{ overflow: 'hidden' }}>
        {members.length === 0 && <div className="k-empty"><div className="k-empty-emoji">👥</div>Ingen medlemmer ennå.</div>}
        {members.map((m) => (
          <div key={m.id}>
            {editId === m.id && draft ? (
              <MemberForm draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={cancel} isNew={false} />
            ) : (
              <div className="k-reg-row">
                <div className="k-avatar">{initials(m.name)}</div>
                <div className="k-reg-main">
                  <span className="k-member-name">{m.name}</span>
                  <div className="k-reg-contact">
                    <span className="k-reg-item"><IconMail size={13} /> {m.email}</span>
                    <span className="k-reg-item k-reg-phone"><IconPhone size={13} /> {formatPhone(m.phone)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="k-iconbtn" title="Rediger" onClick={() => startEdit(m)}><IconEdit size={15} /></button>
                  <button className="k-iconbtn danger" title="Fjern" onClick={() => remove(m)}><IconTrash size={15} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── PrintDocs ─────────────────────────────────────────────────────

function PrintDocs({ mode, round, orders, catalog }: {
  mode: string | null; round: Round | null; orders: MemberOrder[]; catalog: Coffee[]
}) {
  const agg = useMemo(() => aggregate(orders, catalog), [orders, catalog])
  const totalBags = agg.reduce((a, b) => a + b.qty, 0)
  const varesumKr = agg.reduce((a, b) => a + b.sum, 0)
  const today = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <div className={'print-doc' + (mode === 'totals' ? ' active' : '')}>
        <div className="print-head">
          <div><div className="print-brand">☕ CYBER KAFFI LOVERS</div><h1 className="print-h1">Samlebestilling</h1></div>
          <div className="print-meta">{round?.label}<br/>Skrevet ut {today}<br/>{orders.length} medlemmer</div>
        </div>
        <table className="print-table">
          <thead><tr><th>Kaffe</th><th className="num">Antall poser</th><th className="num">Sum</th></tr></thead>
          <tbody>
            {agg.map((r) => <tr key={r.id}><td>{r.name}</td><td className="num">{r.qty}</td><td className="num">{fmtPrice(r.sum)}</td></tr>)}
            <tr className="total"><td>Varesum — {totalBags} poser</td><td className="num"></td><td className="num">{fmtPrice(varesumKr)}</td></tr>
          </tbody>
        </table>
        <div className="print-foot">Priser eks. mva · CYBER Kaffi Lovers · lukket samkjøp fra Supreme Roastworks</div>
      </div>

      <div className={'print-doc' + (mode === 'handout' ? ' active' : '')}>
        <div className="print-head">
          <div><div className="print-brand">☕ CYBER KAFFI LOVERS</div><h1 className="print-h1">Utleveringsliste</h1></div>
          <div className="print-meta">{round?.label}<br/>Skrevet ut {today}</div>
        </div>
        {orders.map((o) => {
          const bd = priceBreakdown(o.items, catalog, round ?? null)
          return (
            <div key={o.email} className="print-member">
              <div className="print-member-head">
                <span className="print-member-name">{o.member}</span>
                <span>{memberBags(o)} poser · <strong>{fmtPrice(bd.total)}</strong></span>
              </div>
              {Object.entries(o.items).map(([id, qty]) => (
                <div key={id} className="print-member-line">
                  <span className="print-check"></span>
                  <span className="print-line-name">{qty}× {nameById(catalog, id)}</span>
                  <span>{fmtPrice(qty * priceById(catalog, id))}</span>
                </div>
              ))}
            </div>
          )
        })}
        <div className="print-foot">Kryss av ved utlevering · betaling via Vipps ved henting</div>
      </div>
    </>
  )
}

// ── AdminScreen (main export) ─────────────────────────────────────

type AdminTab = 'orders' | 'catalog' | 'rounds' | 'members'

interface AdminProps {
  rounds: Round[]
  setRounds: (r: Round[]) => void
  members: Member[]
  setMembers: (m: Member[]) => void
  ordersForRound: (id: string) => MemberOrder[]
  ensureOrdersLoaded: (id: string) => Promise<void>
  saveOrderItems: (orderId: string, items: Record<string, number>, roundId: string) => Promise<void>
  deleteOrder: (orderId: string, roundId: string) => Promise<void>
  toggleOrderPaid: (orderId: string, paid: boolean, roundId: string) => Promise<void>
  catalogForRound: (id: string) => Coffee[]
  saveCatalog: (id: string, list: Coffee[]) => void
  onBack: () => void
}

export default function AdminScreen({ rounds, setRounds, members, setMembers, ordersForRound, ensureOrdersLoaded, saveOrderItems, deleteOrder, toggleOrderPaid, catalogForRound, saveCatalog, onBack }: AdminProps) {
  const [tab, setTab] = useState<AdminTab>('orders')
  const [ordersRoundId, setOrdersRoundIdRaw] = useState(() => (rounds.find((r) => r.status === 'åpen') ?? rounds[0])?.id ?? '')
  const setOrdersRoundId = (id: string) => { setOrdersRoundIdRaw(id); void ensureOrdersLoaded(id) }
  useEffect(() => { if (ordersRoundId) void ensureOrdersLoaded(ordersRoundId) }, [ordersRoundId, ensureOrdersLoaded])
  const [catalogRoundId, setCatalogRoundId] = useState(() => (rounds.find((r) => r.status === 'åpen') ?? rounds[0])?.id ?? '')
  const [printMode, setPrintMode] = useState<string | null>(null)

  const activeRound = rounds.find((r) => r.id === ordersRoundId) ?? null
  const activeOrders = ordersForRound(ordersRoundId)
  const activeCatalog = catalogForRound(ordersRoundId)

  const triggerPrint = (mode: string) => {
    setPrintMode(mode)
    setTimeout(() => { window.print(); setTimeout(() => setPrintMode(null), 500) }, 100)
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'orders', label: 'Bestillinger' },
    { id: 'catalog', label: 'Katalog' },
    { id: 'rounds', label: 'Runder' },
    { id: 'members', label: 'Medlemmer' },
  ]

  return (
    <>
      <PrintDocs mode={printMode} round={activeRound} orders={activeOrders} catalog={activeCatalog} />

      <div className="k-app no-print">
        <header className="k-header no-print">
          <div className="k-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="k-logo" onClick={onBack} aria-label="CYBER Kaffi Lovers">
                <img src="/logo-small.svg" alt="CYBER Kaffi Lovers" style={{ height: 30, width: 'auto', display: 'block' }} />
              </button>
              <span className="k-admin-tag">Admin</span>
            </div>
            <nav className="k-nav">
              {tabs.map((t) => (
                <button key={t.id} className={'k-nav-link' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="k-header-actions">
              <button className="k-headerlink" onClick={onBack}>← Til bestilling</button>
            </div>
          </div>
        </header>

        <main className="k-main">
          {tab === 'orders' && (
            <OrdersView rounds={rounds} roundId={ordersRoundId} setRoundId={setOrdersRoundId}
              members={members} ordersForRound={ordersForRound} catalogForRound={catalogForRound}
              saveOrderItems={saveOrderItems}
              deleteOrder={deleteOrder}
              toggleOrderPaid={toggleOrderPaid}
              onGoRounds={() => setTab('rounds')} onPrint={triggerPrint} />
          )}
          {tab === 'catalog' && (
            <CatalogManager rounds={rounds} roundId={catalogRoundId} setRoundId={setCatalogRoundId}
              catalogForRound={catalogForRound} saveCatalog={saveCatalog} />
          )}
          {tab === 'rounds' && (
            <RoundsManager rounds={rounds} setRounds={setRounds}
              ordersForRound={ordersForRound} catalogForRound={catalogForRound} saveCatalog={saveCatalog} />
          )}
          {tab === 'members' && (
            <MembersManager members={members} setMembers={setMembers} />
          )}
        </main>

        <footer className="k-footer no-print">
          <span>CYBER Kaffi Lovers · Admin</span>
        </footer>
      </div>
    </>
  )
}
