import { cn } from '@/lib/utils'

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   badge?: string,
 *   badgeVariant?: 'critical' | 'warning' | 'success' | 'info',
 *   actions?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export function PageHeader({ title, subtitle, badge, badgeVariant = 'info', actions, className }) {
  const badgeClasses = {
    critical: 'bg-status-critical border-status-critical text-red-700',
    warning:  'bg-status-warning border-status-warning text-amber-700',
    success:  'bg-status-success border-status-success text-green-700',
    info:     'bg-status-info border-status-info text-indigo-700',
  }

  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                badgeClasses[badgeVariant],
              )}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
