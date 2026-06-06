import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: {
        sitekey: string
        callback: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
        size?: 'normal' | 'flexible' | 'compact' | 'invisible'
      }) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

let loadingPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  loadingPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(s)
  })
  return loadingPromise
}

interface Props {
  sitekey: string
  onVerify: (token: string) => void
  onExpired?: () => void
  onError?: () => void
  dark?: boolean
}

export default function Turnstile({ sitekey, onVerify, onExpired, onError, dark }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  const onVerifyRef = useRef(onVerify)
  const onExpiredRef = useRef(onExpired)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpiredRef.current = onExpired
    onErrorRef.current = onError
  }, [onVerify, onExpired, onError])

  useEffect(() => {
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile || widgetId.current) return

        widgetId.current = window.turnstile.render(container.current, {
          sitekey,
          theme: dark ? 'dark' : 'light',
          callback: (token: string) => onVerifyRef.current(token),
          'expired-callback': () => onExpiredRef.current?.(),
          'error-callback': () => onErrorRef.current?.(),
        })
      })
      .catch(() => onErrorRef.current?.())

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          // ignore
        }
        widgetId.current = null
      }
    }
  }, [sitekey, dark])

  return <div ref={container} style={{ display: 'flex', justifyContent: 'center' }} />
}
