// Edge Function — admin creates a member.
//
// Combines two steps:
//   1. Insert into public.members
//   2. Create the corresponding auth.users row so the member can log in.
//
// Supabase gateway verifies the JWT (verify_jwt = true by default) before
// this function runs, so we can trust the decoded claims without a getUser()
// round-trip.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface Body {
  name: string
  email?: string | null
  phone: string
  is_admin?: boolean
}

interface JwtClaims {
  sub?: string
  email?: string
  phone?: string
}

function decodeJwtClaims(token: string): JwtClaims | null {
  try {
    const [, payloadB64] = token.split(".")
    return JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const SUPABASE_URL = mustEnv("SUPABASE_URL")
    const SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE_KEY")

    // ── Identify caller from gateway-verified JWT ────────────────
    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
    if (!token) return json({ error: "no_auth" }, 401)

    const claims = decodeJwtClaims(token)
    if (!claims?.sub) return json({ error: "invalid_token" }, 401)

    const callerEmail = claims.email ?? ""
    const callerPhone = claims.phone ?? ""
    if (!callerEmail && !callerPhone) return json({ error: "no_identity" }, 401)

    // ── Verify caller is admin (service role bypasses RLS) ───────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const orFilter = [
      callerEmail ? `email.ilike.${callerEmail}` : null,
      callerPhone ? `phone.eq.${callerPhone}` : null,
    ]
      .filter(Boolean)
      .join(",")

    const { data: callerMember } = await admin
      .from("members")
      .select("is_admin")
      .or(orFilter)
      .maybeSingle()
    if (!callerMember?.is_admin) return json({ error: "forbidden" }, 403)

    // ── Validate body ────────────────────────────────────────────
    const body = await req.json() as Body
    const name = String(body.name ?? "").trim()
    const email = body.email ? String(body.email).trim().toLowerCase() : null
    const phone = String(body.phone ?? "").replace(/\D/g, "")
    if (!name || !phone) return json({ error: "missing_fields" }, 400)
    if (phone.length < 10 || phone.length > 15) return json({ error: "bad_phone" }, 400)

    // ── Create auth.users (best-effort) ─────────────────────────
    // Auth requires E.164 with leading +; members table stores digits-only.
    // Failure here is non-fatal: the member can still sign in via phone OTP,
    // which creates their auth.users row automatically on first login.
    const createRes = await admin.auth.admin.createUser({
      ...(email ? { email, email_confirm: true } : {}),
      phone, phone_confirm: true,
      user_metadata: { name },
    })
    if (createRes.error && !/already|registered|exist/i.test(createRes.error.message)) {
      console.warn("[createUser] non-fatal:", createRes.error.message)
    }

    // ── Insert into public.members ───────────────────────────────
    const { data: member, error: memErr } = await admin
      .from("members")
      .upsert(
        // Admin-added members are trusted, so they are verified immediately.
        { name, email, phone, is_admin: !!body.is_admin, verified: true },
        { onConflict: "phone" }
      )
      .select()
      .single()
    if (memErr) {
      console.error("[upsert member]", memErr)
      return json({ error: "member_upsert_failed", detail: memErr.message }, 500)
    }

    return json({ member })
  } catch (e) {
    console.error("[admin-create-member]", e)
    return json({ error: "internal_error", detail: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  })
}

function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}
