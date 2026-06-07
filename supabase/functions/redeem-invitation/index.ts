// Edge Function — redeem an invitation campaign (public, no JWT).
//
// Two actions, selected by the POST body's `action` field:
//
//   { action: "info",   campaign_id }
//     → { name, expires_at, expired }   (never returns the password)
//     Used by the invite landing page to show the campaign and whether it is
//     still open before the visitor fills in the form.
//
//   { action: "redeem", campaign_id, password, name, phone }
//     → { ok: true, existing }          (or an error)
//     Validates the password + expiry, then creates the member + auth user the
//     same way admin-create-member does, so the invitee can immediately log in
//     via phone OTP.
//
// This function is configured with verify_jwt = false (see supabase/config.toml)
// because invitees are not authenticated yet. It runs with the service role and
// trusts ONLY the campaign password — so never echo the password back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface Body {
  action?: "info" | "redeem"
  campaign_id?: string
  password?: string
  name?: string
  phone?: string
}

interface Campaign {
  id: string
  name: string
  password: string
  expires_at: string // 'YYYY-MM-DD'
}

// A campaign is valid through the end of its expires_at day (inclusive).
function isExpired(expires_at: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return today > expires_at
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const SUPABASE_URL = mustEnv("SUPABASE_URL")
    const SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const body = await req.json() as Body
    const campaignId = String(body.campaign_id ?? "").trim()
    if (!campaignId) return json({ error: "missing_campaign" }, 400)

    const { data: campaign, error: campErr } = await admin
      .from("invitation_campaigns")
      .select("id, name, password, expires_at")
      .eq("id", campaignId)
      .maybeSingle<Campaign>()
    if (campErr) {
      console.error("[campaign lookup]", campErr)
      return json({ error: "lookup_failed" }, 500)
    }
    if (!campaign) return json({ error: "invalid_campaign" }, 404)

    const expired = isExpired(campaign.expires_at)

    // ── info: public, non-secret campaign details ─────────────────
    if (body.action === "info") {
      return json({ name: campaign.name, expires_at: campaign.expires_at, expired })
    }

    // ── redeem: validate password + expiry, then create member ────
    if (body.action !== "redeem") return json({ error: "unknown_action" }, 400)
    if (expired) return json({ error: "expired" }, 410)

    const password = String(body.password ?? "")
    if (password !== campaign.password) return json({ error: "bad_password" }, 401)

    const name = String(body.name ?? "").trim()
    const phone = String(body.phone ?? "").replace(/\D/g, "")
    if (!name || !phone) return json({ error: "missing_fields" }, 400)
    if (phone.length < 10 || phone.length > 15) return json({ error: "bad_phone" }, 400)

    // Already a member? Reject — they must log in normally rather than
    // re-register. (Returning here also avoids silently texting them an OTP.)
    const { data: existingMember } = await admin
      .from("members")
      .select("id")
      .eq("phone", phone)
      .maybeSingle()
    if (existingMember) return json({ error: "phone_exists" }, 409)

    // ── Create auth.users (best-effort) ─────────────────────────
    // Mirrors admin-create-member: failure here is non-fatal because phone OTP
    // login creates the auth row on first sign-in anyway.
    const createRes = await admin.auth.admin.createUser({
      phone, phone_confirm: true,
      user_metadata: { name },
    })
    if (createRes.error && !/already|registered|exist/i.test(createRes.error.message)) {
      console.warn("[createUser] non-fatal:", createRes.error.message)
    }

    // ── Insert into public.members (never admin via invite) ──────
    const { error: memErr } = await admin
      .from("members")
      .upsert(
        // Unverified until they complete their first SMS login. A pg_cron job
        // deletes them (and their auth user) if they never do within 15 min.
        { name, email: null, phone, is_admin: false, verified: false },
        { onConflict: "phone" }
      )
    if (memErr) {
      console.error("[upsert member]", memErr)
      return json({ error: "member_upsert_failed", detail: memErr.message }, 500)
    }

    return json({ ok: true, existing: false })
  } catch (e) {
    console.error("[redeem-invitation]", e)
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
