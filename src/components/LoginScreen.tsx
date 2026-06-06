import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardContent, Button, Input, Label } from './ui'
import { IconLock, LogoLarge } from './icons'
import { normalizePhone, isValidPhone, formatPhone } from '../lib/phone'
import Turnstile from './Turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

interface Props {
  onLogin: () => void
}

export default function LoginScreen({ onLogin: _onLogin }: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
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

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isValidPhone(phoneInput)) { setError('Ugyldig telefonnummer.'); return }
    if (captchaRequired && !captchaToken) { setError('Bekreft at du ikke er en robot.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      })
      if (error) throw error
      setStep('otp')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/not found|signups? not allowed|user.*not/i.test(msg)) {
        setError('Dette nummeret er ikke i medlemslisten. Be om en invitasjon.')
      } else if (/captcha/i.test(msg)) {
        setError('Captcha-sjekken feilet. Prøv igjen.')
      } else {
        setError(msg)
      }
    } finally {
      resetCaptcha()
      setLoading(false)
    }
  }

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
      if (error) throw error
      // Auth listener in App.tsx will pick up the session.
    } catch {
      setError('Ugyldig eller utløpt kode. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

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
            {step === 'phone' && (
              <form onSubmit={submitPhone} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="k-invite-note">
                  <IconLock size={14} color="var(--primary)" />
                  <span>Ikke medlem? Se #offtopic-kaffi-lovers på Slack</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input id="phone" type="tel" inputMode="tel" placeholder="934 12 087" value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)} required autoComplete="tel" />
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
                <Button type="submit" disabled={loading || !phoneInput || (captchaRequired && !captchaToken)}>
                  {loading ? 'Sender…' : 'Send engangskode'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={submitOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>
                  Vi sendte en 6-sifret kode til <strong>{formatPhone(phone)}</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="otp">Engangskode</Label>
                  <Input id="otp" type="text" inputMode="numeric" placeholder="123456" value={otp}
                    onChange={(e) => setOtp(e.target.value)} maxLength={6} autoComplete="one-time-code" />
                </div>
                {error && <p className="k-err">{error}</p>}
                <Button type="submit" disabled={loading || otp.length < 6}>{loading ? 'Sjekker…' : 'Logg inn'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setStep('phone'); setOtp('') }}>Tilbake</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
