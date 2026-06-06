// Catalog import — parse a pasted Supreme-style price list.
//
// Each coffee is one line with a Norwegian price marker ("320,-"). The
// following line(s) up to the next priced line are the tasting notes.
//
// Discount syntax ("(B) -25% 395,- 296,-") is supported: we use the LAST
// number as the actual price (the post-discount price) and strip the
// markers from the name.

export interface ParsedCoffee {
  name: string
  price: number
  notes: string
}

// Matches the *first* end-of-name marker on a line: either a discount
// percentage ("-25%") or a Norwegian price ("320,-").
const FIRST_MARKER = /\s(?:-\d+%|\d+\s*,-)/
// All price-like numbers in a line: "320,-" or "320 ,-" → 320
const ALL_PRICES = /(\d+)\s*,-/g

export function parseImport(text: string): ParsedCoffee[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: { name: string; price: number; notes: string[] }[] = []

  for (const line of lines) {
    const markerMatch = line.match(FIRST_MARKER)
    const prices = Array.from(line.matchAll(ALL_PRICES)).map((m) => parseInt(m[1], 10))

    if (markerMatch && markerMatch.index !== undefined && prices.length > 0) {
      // Coffee name line
      const name = line.slice(0, markerMatch.index).trim().replace(/[,;\s]+$/, '')
      const price = prices[prices.length - 1]  // last price = post-discount
      if (name && price > 0) items.push({ name, price, notes: [] })
      continue
    }

    // Notes line — attach to the most recent coffee
    if (items.length) items[items.length - 1].notes.push(line)
    // (lines before any coffee are silently dropped)
  }

  return items.map((i) => ({
    name: i.name,
    price: i.price,
    notes: i.notes.join(' '),
  }))
}

// Slug for the `coffee_key` column. Same coffee across rounds should slug
// the same way, so admins can update prices without orphaning order_items.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
