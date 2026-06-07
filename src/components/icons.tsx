interface IconProps {
  size?: number
  color?: string
  style?: React.CSSProperties
  className?: string
}

const icon = (path: string) =>
  ({ size = 16, color = 'currentColor', style, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      <path d={path} />
    </svg>
  )

const svgIcon = (children: React.ReactNode) =>
  ({ size = 16, color = 'currentColor', style, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      {children}
    </svg>
  )

export const IconPlus      = icon('M12 5v14M5 12h14')
export const IconMinus     = icon('M5 12h14')
export const IconTrash     = svgIcon(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>)
export const IconLock      = svgIcon(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>)
export const IconEdit      = svgIcon(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>)
export const IconCheck     = svgIcon(<><polyline points="20 6 9 17 4 12"/></>)
export const IconClock     = svgIcon(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>)
export const IconMail      = svgIcon(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></>)
export const IconCoffee    = svgIcon(<><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>)
export const IconCalendar  = svgIcon(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>)
export const IconRepeat    = svgIcon(<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>)
export const IconBack      = svgIcon(<><polyline points="15 18 9 12 15 6"/></>)
export const IconChevronDown = svgIcon(<><polyline points="6 9 12 15 18 9"/></>)
export const IconMoon      = svgIcon(<><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>)
export const IconSun       = svgIcon(<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>)
export const IconPhone     = svgIcon(<><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8a16 16 0 006.29 6.29l1.18-1.18a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></>)
export const IconPrinter   = svgIcon(<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>)
export const IconReceipt   = svgIcon(<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></>)
export const IconUsers     = svgIcon(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>)
export const IconCopy      = svgIcon(<><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>)
export const IconSettings  = svgIcon(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 00-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>)

export function LogoSmall({ height = 30 }: { height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={Math.round(height * 5)} height={height} viewBox="0 0 200 40" aria-hidden="true">
      <g stroke="#c8835a" strokeWidth="0.6" fill="none" opacity="0.5">
        <polyline points="6,14 3,14 3,10"/><polyline points="6,26 3,26 3,30"/>
        <polyline points="34,14 37,14 37,10"/><polyline points="34,26 37,26 37,30"/>
      </g>
      <g fill="#a8502e" opacity="0.7">
        <circle cx="3" cy="10" r="1.5"/><circle cx="3" cy="30" r="1.5"/>
        <circle cx="37" cy="10" r="1.5"/><circle cx="37" cy="30" r="1.5"/>
      </g>
      
      <path d="M20,4 L34,10 L34,24 Q34,33 20,37 Q6,33 6,24 L6,10 Z" fill="#ede3d4" stroke="#a8502e" strokeWidth="1.2"/>
      <path d="M20,7 L31,12 L31,23 Q31,30 20,34 Q9,30 9,23 L9,12 Z" fill="#e4d5be"/>
      <rect x="12" y="14" width="16" height="16" rx="2" fill="#fefefb" stroke="#a8502e" strokeWidth="0.9"/>
      <rect x="13.5" y="15.5" width="13" height="5" rx="1.5" fill="#6b3a1f"/>
      <path d="M28.5,18 Q32,18 32,22 Q32,26 28.5,26" stroke="#a8502e" fill="none" strokeWidth="1.2" strokeLinecap="round"/>
     
      <g stroke="#a8502e" fill="none" strokeWidth="0.9" strokeLinecap="round" opacity="0.6">
        <path d="M16,13.5 L16,10.5 L17.2,9 L16,7.5"/>
        <path d="M20,13.5 L20,10 L21.2,8.5 L20,7"/>
        <path d="M24,13.5 L24,10.5 L22.8,9 L24,7.5"/>
      </g>
      <text x="46" y="24" fill="currentColor" fontSize="13" fontWeight="500" fontFamily="sans-serif" letterSpacing="0.5">CYBER KAFFI LOVERS</text>
    </svg>
  )
}

export function LogoLarge({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" aria-hidden="true" style={style} className={className}>
      <circle cx="240" cy="240" r="210" fill="none" stroke="#e2d5c3" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="240" cy="240" r="195" fill="none" stroke="#e2d5c3" strokeWidth="0.5"/>
      <polygon points="240,72 268,88 268,120 240,136 212,120 212,88" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <polygon points="184,124 212,140 212,172 184,188 156,172 156,140" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <polygon points="296,124 324,140 324,172 296,188 268,172 268,140" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <polygon points="184,292 212,308 212,340 184,356 156,340 156,308" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <polygon points="296,292 324,308 324,340 296,356 268,340 268,308" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <polygon points="240,340 268,356 268,388 240,404 212,388 212,356" fill="#f2ece0" stroke="#e2d5c3" strokeWidth="0.8"/>
      <g stroke="#c8835a" strokeWidth="1" fill="none" opacity="0.6">
        <polyline points="200,154 178,154 178,134 156,134"/>
        <polyline points="168,162 146,162 146,182"/>
        <polyline points="280,154 302,154 302,134 324,134"/>
        <polyline points="312,162 334,162 334,182"/>
        <polyline points="190,322 168,322 168,342 146,342"/>
        <polyline points="172,310 150,310 150,292"/>
        <polyline points="290,322 312,322 312,342 334,342"/>
        <polyline points="306,310 328,310 328,292"/>
      </g>
      <g fill="#a8502e" opacity="0.8">
        <circle cx="156" cy="134" r="3"/><circle cx="146" cy="182" r="3"/>
        <circle cx="324" cy="134" r="3"/><circle cx="334" cy="182" r="3"/>
        <circle cx="146" cy="342" r="3"/><circle cx="150" cy="292" r="3"/>
        <circle cx="334" cy="342" r="3"/><circle cx="328" cy="292" r="3"/>
        <rect x="168" y="151" width="6" height="6" rx="1"/>
        <rect x="302" y="151" width="6" height="6" rx="1"/>
        <rect x="166" y="307" width="6" height="6" rx="1"/>
        <rect x="303" y="307" width="6" height="6" rx="1"/>
      </g>
      <path d="M240,96 L322,132 L322,238 Q322,296 240,324 Q158,296 158,238 L158,132 Z" fill="#ede3d4" stroke="#a8502e" strokeWidth="2"/>
      <path d="M240,112 L308,144 L308,236 Q308,286 240,310 Q172,286 172,236 L172,144 Z" fill="#e4d5be"/>
      <ellipse cx="240" cy="264" rx="48" ry="7" fill="#ede3d4" stroke="#a8502e" strokeWidth="1.5"/>
      <rect x="203" y="188" width="74" height="74" rx="6" fill="#fefefb" stroke="#a8502e" strokeWidth="1.5"/>
      <rect x="208" y="193" width="64" height="24" rx="3" fill="#6b3a1f"/>
      <line x1="208" y1="228" x2="272" y2="228" stroke="#c8835a" strokeWidth="0.8" opacity="0.5"/>
      <line x1="208" y1="240" x2="272" y2="240" stroke="#c8835a" strokeWidth="0.8" opacity="0.5"/>
      <path d="M277,207 Q298,207 298,229 Q298,251 277,251" stroke="#a8502e" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
     
      <g stroke="#a8502e" fill="none" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
        <path d="M223,185 L223,172 L228,165 L223,158"/>
        <path d="M240,185 L240,170 L245,163 L240,156"/>
        <path d="M257,185 L257,172 L252,165 L257,158"/>
      </g>
      <g fill="#9a7060" fontFamily="monospace" fontSize="10" textAnchor="middle" opacity="0.7">
        <text x="214" y="151">0</text><text x="232" y="146">1</text>
        <text x="250" y="151">0</text><text x="262" y="141">1</text>
        <text x="218" y="143">1</text>
      </g>
      <path id="ckl-top-arc" d="M 55,240 A 185,185 0 0,1 425,240" fill="none"/>
      <path id="ckl-bottom-arc" d="M 72,262 A 171,171 0 0,0 408,262" fill="none"/>
      <text fill="currentColor" fontSize="15" fontWeight="500" fontFamily="sans-serif" letterSpacing="5" transform="translate(1.0578512,9.8842975)">
        <textPath href="#ckl-top-arc" startOffset="50%" textAnchor="middle">CYBER KAFFI LOVERS</textPath>
      </text>
      <text fill="var(--muted-foreground)" fontSize="11" fontFamily="sans-serif" letterSpacing="3.5" transform="translate(1.0578512,26.876033)">
        <textPath href="#ckl-bottom-arc" startOffset="50%" textAnchor="middle">DEFEND · BREW · REPEAT</textPath>
      </text>
      <g fill="#a8502e" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 240 240" to="360 240 240" dur="60s" repeatCount="indefinite"/>
        <circle cx="240" cy="30" r="3"/><circle cx="240" cy="450" r="3"/>
        <circle cx="30" cy="240" r="3"/><circle cx="450" cy="240" r="3"/>
      </g>
      <g fill="#a8502e" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 240 240" to="-360 240 240" dur="60s" repeatCount="indefinite"/>
        <circle cx="102" cy="102" r="2"/><circle cx="378" cy="102" r="2"/>
        <circle cx="102" cy="378" r="2"/><circle cx="378" cy="378" r="2"/>
      </g>
    </svg>
  )
}
