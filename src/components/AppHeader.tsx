import { IconMoon, IconSun, LogoSmall } from './icons'

interface Props {
  onLogoClick: () => void
  badge?: React.ReactNode
  nav: React.ReactNode
  dark: boolean
  onToggleDark: () => void
  onLogout: () => void
}

export default function AppHeader({ onLogoClick, badge, nav, dark, onToggleDark, onLogout }: Props) {
  return (
    <header className="k-header no-print">
      <div className="k-header-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="k-logo" style={{ order: 0 }} onClick={onLogoClick} aria-label="CYBER Kaffi Lovers">
            <LogoSmall height={30} />
          </button>
          {badge}
        </div>
        <nav className="k-nav">{nav}</nav>
        <div className="k-header-actions">
          <button className="k-btn k-btn-ghost k-btn-icon" onClick={onToggleDark} aria-label="Bytt tema">
            {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={onLogout}>Logg ut</button>
        </div>
      </div>
    </header>
  )
}
