// Phone number helpers. We store the digits-only-with-country-code form
// (e.g. "4793412087") because that's what Supabase Auth uses internally.
// In the UI we display the friendlier "+47 934 12 087".

/** Normalize anything reasonable to digits-only with NO country code default. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  // Bare 8-digit Norwegian number → prefix 47
  if (/^\d{8}$/.test(digits)) digits = '47' + digits
  return digits
}

/** "4793412087" → "+47 934 12 087" for display. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '')
  if (/^47\d{8}$/.test(d)) {
    const n = d.slice(2)
    return `+47 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5)}`
  }
  return e164.startsWith('+') ? e164 : '+' + d
}

/** Loose validation — at least 10 digits including country code. */
export function isValidPhone(input: string): boolean {
  const d = normalizePhone(input)
  return d.length >= 10 && d.length <= 15
}
