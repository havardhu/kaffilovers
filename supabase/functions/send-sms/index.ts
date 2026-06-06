// Supabase Send SMS Hook → Sveve.no
//
// Wiring:
//   Dashboard → Authentication → Hooks → "Send SMS hook" → URI of this function
//
// Required secrets:
//   SEND_SMS_HOOK_SECRET   — value Supabase generates when you register the hook
//                             (format: "v1,whsec_xxxxxx")
//   SVEVE_USER             — Sveve API username
//   SVEVE_PASSWORD         — Sveve API password
//   SVEVE_SENDER           — optional, sender name (max 11 chars alphanumeric)

interface HookPayload {
  user: { id: string; phone?: string }
  sms: { otp: string }
}

Deno.serve(async (req) => {
  const body = await req.text()
  try {
    if (!(await verifyWebhook(req, body))) {
      return json({ error: "invalid_signature" }, 401)
    }

    const payload = JSON.parse(body) as HookPayload
    const phone = payload.user.phone
    const otp = payload.sms.otp
    if (!phone || !otp) return json({ error: "missing_phone_or_otp" }, 400)

    // Sveve expects the recipient as 8-digit Norwegian number, no country code.
    const to = phone.replace(/^47/, '')

    const SVEVE_USER     = mustEnv("SVEVE_USER")
    const SVEVE_PASSWORD = mustEnv("SVEVE_PASSWORD")
    const SVEVE_SENDER   = Deno.env.get("SVEVE_SENDER")

    const msg = `Din innloggingskode til Kaffi Lovers: ${otp}`
    const url = new URL("https://sveve.no/SMS/SendMessage")
    url.searchParams.set("user", SVEVE_USER)
    url.searchParams.set("passwd", SVEVE_PASSWORD)
    url.searchParams.set("to", to)
    url.searchParams.set("msg", msg)
    if (SVEVE_SENDER) url.searchParams.set("from", SVEVE_SENDER)

    const res = await fetch(url, { method: "GET" })
    const text = await res.text()
    if (!res.ok) {
      console.error("[sveve]", res.status, text)
      return json({ error: "sveve_failed", status: res.status, detail: text }, 502)
    }
    // Sveve typically returns "1 OK ..." on success. Treat any non-2xx as error.
    return json({ ok: true })
  } catch (e) {
    console.error("[send-sms]", e)
    return json({ error: "internal_error", detail: String(e) }, 500)
  }
})

// ── Standard Webhooks signature verification ─────────────────────────────
async function verifyWebhook(req: Request, body: string): Promise<boolean> {
  const raw = Deno.env.get("SEND_SMS_HOOK_SECRET")
  if (!raw) { console.error("Missing SEND_SMS_HOOK_SECRET"); return false }
  const id = req.headers.get("webhook-id")
  const ts = req.headers.get("webhook-timestamp")
  const sig = req.headers.get("webhook-signature")
  if (!id || !ts || !sig) return false

  // Secret format from Supabase: "v1,whsec_<base64>"
  const b64 = raw.startsWith("v1,whsec_") ? raw.slice(9) : raw
  const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const signedPayload = `${id}.${ts}.${body}`
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload))
  const computed = btoa(String.fromCharCode(...new Uint8Array(signed)))

  // Header may carry multiple "v1,<base64>" entries, space-separated
  return sig.split(" ").some((s) => {
    const v = s.startsWith("v1,") ? s.slice(3) : s
    return v === computed
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  })
}

function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}
