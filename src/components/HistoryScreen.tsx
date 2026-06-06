import { useState } from 'react'
import type { PastOrder, Coffee, Round } from '../lib/types'
import { fmtPrice, priceBreakdown } from '../lib/utils'
import { Card, Badge } from './ui'

import { IconCalendar, IconBack, IconCheck, IconClock } from './icons'

function nameOf(catalog: Coffee[], id: string) {
  return catalog.find((x) => x.id === id)?.name ?? id
}
function priceOf(catalog: Coffee[], id: string) {
  return catalog.find((x) => x.id === id)?.price ?? 0
}

function PastOrderCard({
  order, defaultOpen, getCatalog, getRound, showPaid,
}: {
  order: PastOrder
  defaultOpen?: boolean
  showPaid?: boolean
  getCatalog: (id: string) => Coffee[]
  getRound: (id: string) => Round | null
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const catalog = getCatalog(order.round_id ?? order.id)
  const round = getRound(order.round_id ?? order.id)
  const bd = priceBreakdown(order.items, catalog, round)
  return (
    <Card className="k-history-card">
      <button className="k-history-head" onClick={() => setOpen((o) => !o)}>
        <div className="k-history-icon"><IconCalendar size={16} color="var(--primary)" /></div>
        <div className="k-history-meta">
          <div className="k-history-title-row">
            <span style={{ fontWeight: 600 }}>{order.label}</span>
            {showPaid && (
              <Badge variant={order.paid ? 'safe' : 'closed'}>
                {order.paid
                  ? <><IconCheck size={11} /> Betalt</>
                  : <><IconClock size={11} /> Ikke betalt</>}
              </Badge>
            )}
          </div>
          <span className="k-history-sub">
            {order.date} · {bd.bags} {bd.bags === 1 ? 'pose' : 'poser'} · {fmtPrice(bd.total)}
          </span>
        </div>
        <span className={'k-chev' + (open ? ' open' : '')}>
          <IconBack size={16} style={{ transform: 'rotate(-90deg)' }} />
        </span>
      </button>
      {open && (
        <div className="k-history-body">
          {order.items.map((it) => (
            <div key={it.id} className="k-history-line">
              <span className="k-receipt-qty">{it.qty}×</span>
              <span className="k-receipt-name">{nameOf(catalog, it.id)}</span>
              <span className="k-receipt-sum">{fmtPrice(priceOf(catalog, it.id) * it.qty)}</span>
            </div>
          ))}
          {(bd.gebyr > 0 || bd.mva > 0) && (
            <div className="k-history-breakdown">
              {bd.gebyr > 0 && (
                <div className="k-history-line k-bd-line">
                  <span className="k-bd-label">Administrasjonsgebyr ({fmtPrice(bd.adminFee)} × {bd.bags})</span>
                  <span className="k-receipt-sum">{fmtPrice(bd.gebyr)}</span>
                </div>
              )}
              <div className="k-history-line k-bd-line k-bd-total">
                <span className="k-bd-label">Å betale</span>
                <span className="k-receipt-sum">{fmtPrice(bd.total)}</span>
              </div>
              {bd.mva > 0 && (
                <div className="k-history-line k-bd-line">
                  <span className="k-bd-label">Herav mva ({bd.vatRate} %)</span>
                  <span className="k-receipt-sum">{fmtPrice(bd.mva)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

interface Props {
  currentOrder: PastOrder | null
  pastOrders: PastOrder[]
  getCatalog: (id: string) => Coffee[]
  getRound: (id: string) => Round | null
}

export default function HistoryScreen({ currentOrder, pastOrders, getCatalog, getRound }: Props) {
  const empty = !currentOrder && pastOrders.length === 0
  return (
    <div className="k-page">
      <div className="k-page-head">
        <div>
          <h1 className="k-page-title">Mine bestillinger</h1>
        </div>
      </div>

      {empty && (
        <Card><div style={{ padding: 36, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>☕</div>
          <p style={{ margin: 0 }}>Ingen bestillinger ennå.</p>
        </div></Card>
      )}

      {currentOrder && (
        <>
          <p className="k-section-label">Aktiv bestilling</p>
          <PastOrderCard order={currentOrder} defaultOpen getCatalog={getCatalog} getRound={getRound} />
        </>
      )}

      {pastOrders.length > 0 && (
        <>
          <p className="k-section-label" style={{ marginTop: currentOrder ? 20 : 0 }}>Historikk</p>
          <div className="k-history-list">
            {pastOrders.map((o) => (
              <PastOrderCard key={o.id} order={o} showPaid getCatalog={getCatalog} getRound={getRound} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
