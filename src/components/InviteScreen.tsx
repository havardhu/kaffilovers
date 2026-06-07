import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'
import { Card, CardHeader, CardContent, Button, Input, Label } from './ui'
import { IconLock, LogoLarge } from './icons'
import { normalizePhone, isValidPhone, formatPhone } from '../lib/phone'
import { fmtDeadline } from '../lib/utils'
import Turnstile from './Turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

interface Props {
  campaignId: string
  /** Drop the ?invite param and fall back to the normal login screen. */
  onExit: () => void
}

// Maps a server error code from redeem-invitation to a Norwegian message.
function redeemError(code: string): string {
  switch (code) {
    case 'expired':         return 'Denne invitasjonen har utløpt. Be om en ny lenke på Slack.'
    case 'phone_exists':    return 'Dette telefonnummeret er allerede registrert. Logg inn i stedet.'
    case 'bad_password':    return 'Feil passord. Sjekk passordet fra Slack-invitasjonen.'
    case 'invalid_campaign': return 'Ugyldig invitasjonslenke.'
    case 'bad_phone':       return 'Ugyldig telefonnummer.'
    case 'missing_fields':  return 'Fyll inn navn og telefonnummer.'
    default:                return 'Kunne ikke fullføre registreringen. Prøv igjen.'
  }
}

export default function InviteScreen({ campaignId, onExit }: Props) {
  const [info, setInfo] = useState<db.InviteInfo | null>(null)
  const [infoError, setInfoError] = useState(false)
  const [loadingInfo, setLoadingInfo] = useState(true)

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [name, setName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  const phone = normalizePhone(phoneInput)
  const captchaRequired = !!TURNSTILE_SITE_KEY

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }, [])

  // Load non-secret campaign details up front so we can greet the invitee and
  // show an "expired"/"invalid" state before they fill anything in.
  useEffect(() => {
    let active = true
    db.fetchInviteInfo(campaignId)
      .then((i) => { if (active) setInfo(i) })
      .catch(() => { if (active) setInfoError(true) })
      .finally(() => { if (active) setLoadingInfo(false) })
    return () => { active = false }
  }, [campaignId])

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) { setError('Skriv inn navnet ditt.'); return }
    if (!isValidPhone(phoneInput)) { setError('Ugyldig telefonnummer.'); return }
    if (!password.trim()) { setError('Skriv inn passordet fra invitasjonen.'); return }
    if (captchaRequired && !captchaToken) { setError('Bekreft at du ikke er en robot.'); return }
    setLoading(true)
    try {
      await db.redeemInvitation({ campaignId, password: password.trim(), name: name.trim(), phone })
      // Member now exists — send a login code to their phone.
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      })
      if (otpErr) throw otpErr
      setStep('otp')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // db.redeemInvitation throws the bare server code; OTP errors are messages.
      if (/captcha/i.test(msg)) setError('Captcha-sjekken feilet. Prøv igjen.')
      else setError(redeemError(msg))
      resetCaptcha()
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
      if (vErr) throw vErr
      // Clean the invite param out of the URL; the auth listener in App.tsx
      // takes over from here and renders the app.
      onExit()
    } catch {
      setError('Ugyldig eller utløpt kode. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  const expired = info?.expired || (infoError)

  return (
    <div className="k-login-wrap">
      <div className="k-login-card">
        <Card>
          <CardHeader>
            <div style={{ textAlign: 'center' }}>
              <LogoLarge style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }} />
            </div>
          </CardHeader>
          <CardContent>
            {loadingInfo ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted-foreground)' }}>Laster invitasjon…</p>
            ) : infoError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="k-err" style={{ margin: 0 }}>Ugyldig invitasjonslenke.</p>
                <Button type="button" variant="ghost" size="sm" onClick={onExit}>Til innlogging</Button>
              </div>
            ) : expired ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="k-err" style={{ margin: 0 }}>
                  Denne invitasjonen har utløpt{info ? ` (${fmtDeadline(info.expires_at)})` : ''}. Be om en ny lenke på Slack.
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={onExit}>Til innlogging</Button>
              </div>
            ) : step === 'form' ? (
              <form onSubmit={submitForm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="k-invite-note">
                  <IconLock size={14} color="var(--primary)" />
                  <span>
                    {info?.name ? <><strong>{info.name}</strong> — registrer </> : 'Registrer '}
                    deg som medlem av Kaffi Lovers
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="inv-name">Navn</Label>
                  <Input id="inv-name" type="text" placeholder="Kari S" value={name}
                    onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="inv-phone">Telefonnummer</Label>
                  <Input id="inv-phone" type="tel" inputMode="tel" placeholder="934 12 087" value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)} required autoComplete="tel" />
                  <span className="k-field-hint">Brukes til innlogging via SMS.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="inv-pass">Passord fra invitasjonen</Label>
                  <Input id="inv-pass" type="text" placeholder="Lim inn passordet fra invitasjonen" value={password}
                    onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
                </div>
                {captchaRequired && (
                  <Turnstile
                    key={captchaKey}
                    sitekey={TURNSTILE_SITE_KEY!}
                    onVerify={setCaptchaToken}
                    onExpired={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                )}
                {error && <p className="k-err">{error}</p>}
                <Button type="submit" disabled={loading || !name || !phoneInput || !password || (captchaRequired && !captchaToken)}>
                  {loading ? 'Registrerer…' : 'Bli medlem'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onExit}>Allerede medlem? Logg inn</Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>
                  Vi sendte en 6-sifret kode til <strong>{formatPhone(phone)}</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="inv-otp">Engangskode</Label>
                  <Input id="inv-otp" type="text" inputMode="numeric" placeholder="123456" value={otp}
                    onChange={(e) => setOtp(e.target.value)} maxLength={6} autoComplete="one-time-code" />
                </div>
                {error && <p className="k-err">{error}</p>}
                <Button type="submit" disabled={loading || otp.length < 6}>{loading ? 'Sjekker…' : 'Logg inn'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setStep('form'); setOtp(''); resetCaptcha() }}>Tilbake</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
