import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'

interface Breadcrumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  breadcrumbs?: Breadcrumb[]
  serif?: boolean
  className?: string
}

export function PageHeader({
  title, subtitle, eyebrow, actions, breadcrumbs, serif = false, className,
}: PageHeaderProps) {
  return (
    <div className={clsx(
      'relative bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5',
      className
    )}>
      <div className="flex items-start justify-between gap-4 px-8 py-5">
        <div className="min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate mb-2.5">
              {breadcrumbs.map((bc, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {bc.to ? (
                    <a href={bc.to} className="hover:text-rihla transition-colors">
                      {bc.label}
                    </a>
                  ) : (
                    <span className={i === breadcrumbs.length - 1 ? 'text-ink font-medium' : ''}>
                      {bc.label}
                    </span>
                  )}
                  {i < breadcrumbs.length - 1 && <ChevronRight size={12} className="text-fog" />}
                </div>
              ))}
            </div>
          )}

          {eyebrow && (
            <p className="text-eyebrow mb-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-rihla font-medium">
              {eyebrow}
            </p>
          )}

          <h1 className={clsx(
            'text-[22px] font-semibold text-slate-900 dark:text-cream leading-tight tracking-tight',
            serif && 'font-serif'
          )}>
            {title}
          </h1>

          {subtitle && (
            <p className="text-[13px] text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
