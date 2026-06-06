import React from 'react'
import { IconPlus, IconMinus, IconTrash } from './icons'

export const Card = ({ children, style = {}, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={'k-card ' + className} style={style} {...rest}>{children}</div>
)
export const CardHeader  = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => <div className="k-card-header" style={style}>{children}</div>
export const CardContent = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => <div className="k-card-content" style={style}>{children}</div>

export const Badge = ({ children, variant = 'default', style = {} }: { children: React.ReactNode; variant?: string; style?: React.CSSProperties }) => (
  <span className={'k-badge k-badge-' + variant} style={style}>{children}</span>
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'lg' | 'icon'
}
export const Button = ({ children, variant = 'default', size, className = '', style = {}, ...rest }: ButtonProps) => {
  let cls = 'k-btn k-btn-' + variant
  if (size === 'sm') cls += ' k-btn-sm'
  if (size === 'lg') cls += ' k-btn-lg'
  if (size === 'icon') cls += ' k-btn-icon'
  return <button className={cls + (className ? ' ' + className : '')} style={style} {...rest}>{children}</button>
}

export const Input = ({ style = {}, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="k-input" style={style} {...rest} />
)
export const Label = ({ children, htmlFor, style = {} }: { children: React.ReactNode; htmlFor?: string; style?: React.CSSProperties }) => (
  <label className="k-label" htmlFor={htmlFor} style={style}>{children}</label>
)

export function Stepper({ value, onChange, size = 'md', disabled = false }: {
  value: number; onChange: (v: number) => void; size?: 'sm' | 'md'; disabled?: boolean
}) {
  const small = size === 'sm'
  const dim = small ? 30 : 36
  if (!value) {
    return (
      <button className="k-btn k-btn-outline k-add-btn" style={{ height: dim, padding: small ? '0 12px' : '0 16px' }}
        onClick={() => onChange(1)} disabled={disabled}>
        <IconPlus size={15} /> Legg til
      </button>
    )
  }
  return (
    <div className="k-stepper" style={{ height: dim }}>
      <button className="k-step-btn" style={{ width: dim, height: dim }} onClick={() => onChange(value - 1)} disabled={disabled} aria-label="Fjern én">
        {value === 1 ? <IconTrash size={14} /> : <IconMinus size={15} />}
      </button>
      <span className="k-step-val" style={{ minWidth: small ? 22 : 28 }}>{value}</span>
      <button className="k-step-btn" style={{ width: dim, height: dim }} onClick={() => onChange(value + 1)} disabled={disabled} aria-label="Legg til én">
        <IconPlus size={15} />
      </button>
    </div>
  )
}
