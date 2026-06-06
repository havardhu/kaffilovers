import { useMemo } from 'react'
import type { Coffee, Round, Cart } from '../lib/types'
import { ROUND_BADGE } from '../lib/types'
import { fmtPrice, priceBreakdown, priceIncVat } from '../lib/utils'
import { Card, Badge, Button, Stepper } from './ui'
import { IconCoffee, IconClock, IconLock, IconEdit, IconCheck, IconRepeat, IconChevronDown, IconTrash } from './icons'

function LastBadge({ qty }: { qty: number }) {
  return (
    <span className="k-last-badge" title={'Du bestilte ' + qty + ' forrige runde'}>
      <IconRepeat size={11} /> Bestilte sist · {qty}
    </span>
  )
}

function OrderedQty({ qty }: { qty: number }) {
  return (
    <span className="k-ordered-qty" title={'Bestilt: ' + qty}>
      <IconCheck size={13} /> {qty} {qty === 1 ? 'pose' : 'poser'}
    </span>
  )
}

function PricePair({ weight, price }: { weight: string; price: number }) {
  return (
    <div className="k-price-pair">
      <span className="k-price">{fmtPrice(price)}</span>
      <span className="k-weight">{weight}</span>
    </div>
  )
}

interface ItemProps {
  item: Coffee
  qty: number
  last: number
  readOnly: boolean
  onChange: (v: number) => void
}

function ListItem({ item, qty, last, readOnly, onChange }: ItemProps) {
  return (
    <div className={'k-list-row' + (qty ? ' in-cart' : '')}>
      <div className="k-list-main">
        <div className="k-item-title-row">
          <span className="k-item-name">{item.name}</span>
          {last ? <LastBadge qty={last} /> : null}
        </div>
        <p className="k-item-notes">{item.notes}</p>
      </div>
      <div className="k-list-aside">
        <PricePair weight={item.weight} price={item.price} />
        {!readOnly ? <Stepper value={qty} onChange={onChange} size="sm" /> : (qty > 0 && <OrderedQty qty={qty} />)}
      </div>
    </div>
  )
}

function RichCard({ item, qty, last, readOnly, onChange }: ItemProps) {
  return (
    <Card className={'k-coffee-card' + (qty ? ' in-cart' : '')}>
      <div className="k-card-body">
        <div className="k-bean-mark"><IconCoffee size={18} color="var(--primary)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="k-item-title-row">
            <span className="k-item-name">{item.name}</span>
            {last ? <LastBadge qty={last} /> : null}
          </div>
          <p className="k-item-notes">{item.notes}</p>
          <div className="k-card-foot">
            <PricePair weight={item.weight} price={item.price} />
            {!readOnly ? <Stepper value={qty} onChange={onChange} /> : (qty > 0 && <OrderedQty qty={qty} />)}
          </div>
        </div>
      </div>
    </Card>
  )
}

function GridCard({ item, qty, last, readOnly, onChange }: ItemProps) {
  return (
    <Card className={'k-grid-card' + (qty ? ' in-cart' : '')}>
      <div className="k-grid-top">
        <div className="k-bean-mark"><IconCoffee size={18} color="var(--primary)" /></div>
        {last ? <LastBadge qty={last} /> : null}
      </div>
      <span className="k-item-name">{item.name}</span>
      <p className="k-item-notes">{item.notes}</p>
      <div className="k-grid-foot">
        <PricePair weight={item.weight} price={item.price} />
        {!readOnly ? <Stepper value={qty} onChange={onChange} size="sm" /> : (qty > 0 && <OrderedQty qty={qty} />)}
      </div>
    </Card>
  )
}

interface Props {
  cart: Cart
  setQty: (id: string, qty: number) => void
  layout: 'grid' | 'card' | 'list'
  showLast: boolean
  lastOrderItems: Record<string, number>
  rounds: Round[]
  roundId: string
  setRoundId: (id: string) => void
  activeRoundId: string | null
  locked: boolean
  onToggleLock: () => void
  hasExistingOrder: boolean
  onDeleteOrder: () => void
  catalogForRound: (id: string) => Coffee[]
}

export default function CatalogScreen({
  cart, setQty, layout, showLast, lastOrderItems,
  rounds, roundId, setRoundId, activeRoundId, locked, onToggleLock,
  hasExistingOrder, onDeleteOrder,
  catalogForRound,
}: Props) {
  const lines = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart])

  if (!rounds || rounds.length === 0) {
    return (
      <div className="k-page">
        <div className="k-page-head"><div><h1 className="k-page-title">Bestilling</h1></div></div>
        <Card><div className="k-card-content" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>☕</div>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Ingen åpen runde akkurat nå</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
            Neste bestillingsrunde er ikke åpnet ennå.
          </p>
        </div></Card>
      </div>
    )
  }

  const round = rounds.find((r) => r.id === roundId) ?? rounds[0]
  const isOpen = round.status === 'åpen'
  const isActive = round.id === activeRoundId
  const editable = isOpen && !locked
  const badge = ROUND_BADGE[round.status] ?? ROUND_BADGE['planlagt']
  const items = catalogForRound(round.id)

  const renderItem = (item: Coffee) => {
    const qty = isOpen ? (cart[item.id] ?? 0) : 0
    const last = (editable && showLast) ? (lastOrderItems[item.id] ?? 0) : 0
    // Members see inc-VAT prices. Catalog price in DB is ex-VAT.
    const displayItem: Coffee = { ...item, price: priceIncVat(item.price, round.vat_rate) }
    const props: ItemProps = { item: displayItem, qty, last, readOnly: !editable, onChange: (v) => setQty(item.id, v) }
    if (layout === 'list') return <ListItem key={item.id} {...props} />
    if (layout === 'card') return <RichCard key={item.id} {...props} />
    return <GridCard key={item.id} {...props} />
  }

  const bd = (isOpen && lines > 0) ? priceBreakdown(cart, items, round) : null

  return (
    <div className="k-page">
      <div className="k-page-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="k-page-title">Bestilling</h1>
          <div className="k-round-switch">
            <div className="k-select-wrap">
              <select className="k-select" value={round.id} onChange={(e) => setRoundId(e.target.value)}>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.label} — {(ROUND_BADGE[r.status] ?? ROUND_BADGE['planlagt']).label}</option>
                ))}
              </select>
              <IconChevronDown size={16} />
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </div>
        {isOpen && isActive && (
          locked ? (
            <Button variant="outline" className="k-lock-btn" onClick={onToggleLock}>
              <IconEdit size={16} /> Lås opp bestilling
            </Button>
          ) : lines === 0 && hasExistingOrder ? (
            <Button variant="outline" className="k-lock-btn" onClick={onDeleteOrder}
              style={{ color: 'var(--destructive)' }}>
              <IconTrash size={16} /> Slett bestilling
            </Button>
          ) : (
            <Button className="k-lock-btn" onClick={onToggleLock} disabled={lines === 0}>
              <IconLock size={16} /> Lås bestilling
            </Button>
          )
        )}
      </div>

      {locked && isOpen && isActive ? (
        <div className="k-window-bar k-window-locked">
          <div className="k-window-item">
            <IconLock size={15} color="var(--primary)" />
            <span>Bestillingen er <strong>låst</strong> — {lines} {lines === 1 ? 'pose' : 'poser'} sendt inn. Lås opp for å endre frem til fristen <strong>{round.deadline}</strong>.</span>
          </div>
        </div>
      ) : isOpen ? (
        <div className="k-window-bar">
          <div className="k-window-item">
            <IconClock size={15} color="var(--primary)" />
            <span>Frist <strong>{round.deadline}</strong></span>
          </div>
        </div>
      ) : (
        <div className={'k-window-bar ' + (round.status === 'lukket' ? 'k-window-closed' : 'k-window-soon')}>
          <div className="k-window-item">
            {round.status === 'lukket' ? <IconLock size={15} /> : <IconClock size={15} />}
            <span>
              {round.status === 'lukket'
                ? <>Runden er lukket — fristen var <strong>{round.deadline}</strong>.</>
                : <>Ikke åpnet ennå. Planlagt frist <strong>{round.deadline}</strong>.</>}
            </span>
          </div>
        </div>
      )}

      {layout === 'list' && <div className="k-list">{items.map(renderItem)}</div>}
      {layout === 'card' && <div className="k-cards">{items.map(renderItem)}</div>}
      {layout === 'grid' && <div className="k-grid">{items.map(renderItem)}</div>}

      {bd && (
        <div className="k-order-total">
          <div className="k-order-rows">
            <div className="k-order-row">
              <span>Kaffe · {bd.bags} {bd.bags === 1 ? 'pose' : 'poser'}</span>
              <span>{fmtPrice(bd.varesum)}</span>
            </div>
            {bd.gebyr > 0 && (
              <div className="k-order-row k-order-row-muted">
                <span>Administrasjonsgebyr ({fmtPrice(bd.adminFee)} × {bd.bags})</span>
                <span>{fmtPrice(bd.gebyr)}</span>
              </div>
            )}
          </div>
          <div className="k-order-row k-order-grand">
            <span className="k-order-total-label">Å betale</span>
            <span className="k-order-total-sum">{fmtPrice(bd.total)}</span>
          </div>
          {bd.mva > 0 && (
            <div className="k-order-row k-order-row-muted">
              <span>Herav mva ({bd.vatRate} %)</span>
              <span>{fmtPrice(bd.mva)}</span>
            </div>
          )}
        </div>
      )}

      <p className="k-catalog-foot">
        {!isOpen
          ? (round.status === 'lukket' ? 'Denne runden er avsluttet.' : 'Du kan legge inn bestilling når runden åpner.')
          : locked
            ? 'Bestillingen er låst. Lås opp øverst for å gjøre endringer.'
            : (lines > 0
                ? `${lines} ${lines === 1 ? 'pose' : 'poser'} valgt — trykk «Lås bestilling» øverst når du er ferdig.`
                : 'Trykk «Legg til» for å begynne bestillingen.')}
      </p>
    </div>
  )
}
