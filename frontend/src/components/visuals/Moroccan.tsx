import { CSSProperties } from 'react'

/* ──────────────────────────────────────────────────────────────────
 * RIHLA — Moroccan / Touristique design primitives
 *
 * Reusable visual fragments inspired by zellige tilework, moorish
 * arches and Berber rugs. Pure SVG/CSS — no external dependency.
 * ──────────────────────────────────────────────────────────────── */

export interface ZelligePatternProps {
  /** Stroke / fill color. Defaults to terracotta (#B43E20). */
  color?: string
  /** Pattern opacity (0-1). Default 0.18. */
  opacity?: number
  /** Tile size in px. Default 80. */
  size?: number
  /** Variant: "star" (8-pointed), "lattice" (overlapping squares), "kasbah" (eight-fold rosette). */
  variant?: 'star' | 'lattice' | 'kasbah'
  /** Extra className for the wrapper. */
  className?: string
  style?: CSSProperties
}

/**
 * Tileable Moroccan pattern overlay. Place inside a `position:relative`
 * parent and stretch it with `absolute inset-0`.
 */
export function ZelligePattern({
  color = '#B43E20',
  opacity = 0.18,
  size = 80,
  variant = 'star',
  className = '',
  style = {},
}: ZelligePatternProps) {
  const svg =
    variant === 'star'
      ? `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 80 80'><g fill='none' stroke='${color}' stroke-width='1' stroke-opacity='${opacity}'><path d='M40 8l8 24 24 8-24 8-8 24-8-24L8 40l24-8z'/><path d='M40 0v80M0 40h80M11.7 11.7l56.6 56.6M68.3 11.7l-56.6 56.6'/></g></svg>`
      : variant === 'lattice'
      ? `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 60 60'><g fill='none' stroke='${color}' stroke-width='1' stroke-opacity='${opacity}'><rect x='15' y='15' width='30' height='30' transform='rotate(45 30 30)'/><rect x='15' y='15' width='30' height='30'/><circle cx='30' cy='30' r='12'/></g></svg>`
      : `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 100 100'><g fill='none' stroke='${color}' stroke-width='1' stroke-opacity='${opacity}'><circle cx='50' cy='50' r='30'/><circle cx='50' cy='50' r='20'/><path d='M50 20l10 30 30 0-25 18 10 30-25-18-25 18 10-30L0 50l30 0z'/></g></svg>`

  const dataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{
        backgroundImage: dataUri,
        backgroundSize: `${size}px ${size}px`,
        backgroundRepeat: 'repeat',
        ...style,
      }}
    />
  )
}

/* ──────────────────────────────────────────────────────────────────
 * MoroccanArch — moorish keyhole arch, used as a card top or as a
 * decorative frame around hero copy.
 * ──────────────────────────────────────────────────────────────── */

export interface MoroccanArchProps {
  color?: string
  width?: number | string
  height?: number | string
  filled?: boolean
  className?: string
}

export function MoroccanArch({
  color = '#B43E20',
  width = '100%',
  height = 24,
  filled = true,
  className = '',
}: MoroccanArchProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M0 24 V14 Q0 0 14 0 Q22 0 26 6 Q30 12 34 12 Q38 12 42 6 Q46 0 50 0 Q54 0 58 6 Q62 12 66 12 Q70 12 74 6 Q78 0 86 0 Q100 0 100 14 V24 Z"
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={filled ? 0 : 2}
      />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────────
 * BerberRule — multicolored horizontal stripe inspired by a Berber rug
 * border. Use as a divider on hero sections.
 * ──────────────────────────────────────────────────────────────── */

export function BerberRule({ className = '' }: { className?: string }) {
  return <div className={`berber-rule ${className}`} aria-hidden />
}

/* ──────────────────────────────────────────────────────────────────
 * DiamondRule — ornate centered divider with sahara-gold diamonds.
 * ──────────────────────────────────────────────────────────────── */

export function DiamondRule({
  label,
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={`diamond-rule ${className}`}>
      <span>◆ {label} ◆</span>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
 * StarBadge — small zellige star used as decorative bullet.
 * ──────────────────────────────────────────────────────────────── */

export function StarBadge({
  size = 16,
  color = '#D4A574',
  className = '',
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      aria-hidden
    >
      <path
        d="M40 8l8 24 24 8-24 8-8 24-8-24L8 40l24-8z"
        fill={color}
      />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────────
 * MoroccanHero — drop-in hero strip behind a page header.
 *
 * Usage:
 *   <MoroccanHero eyebrow="Tableau de bord" title="Bienvenue" />
 * ──────────────────────────────────────────────────────────────── */

export interface MoroccanHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
  className?: string
}

export function MoroccanHero({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  className = '',
}: MoroccanHeroProps) {
  return (
    <section
      className={`hero-moroccan rounded-card overflow-hidden border border-line-soft px-8 py-10 ${className}`}
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          {eyebrow && (
            <p className="eyebrow-moroccan mb-3">{eyebrow}</p>
          )}
          <h1 className="font-serif text-[34px] md:text-[40px] font-bold text-ink leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[14px] text-slate max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
          <BerberRule className="mt-6 max-w-[160px]" />
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </section>
  )
}
