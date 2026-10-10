import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

/**
 * @param {{
 *   label: string,
 *   value: string | number,
 *   unit?: string,
 *   delta?: number,
 *   deltaLabel?: string,
 *   trend?: 'up' | 'down' | 'neutral',
 *   trendPositive?: boolean,
 *   description?: string,
 *   highlight?: boolean,
 *   className?: string,
 * }} props
 */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  trend,
  trendPositive = true,
  description,
  highlight = false,
  className,
}) {
  const isGood =
    trend === 'neutral' ? null
      : (trendPositive ? trend === 'up' : trend === 'down')

  const TrendIcon =
    trend === 'up' ? TrendingUp
      : trend === 'down' ? TrendingDown
        : Minus

  return (
    <div
      className={cn(
        'rounded-[10px] p-5 flex flex-col gap-2 transition-colors',
        /*
          bg-card:
            dark  → #393939  (elevated above #1D1C1E background)
            light → white
          border uses the subtle rgba border token
        */
        'bg-card',
        className,
      )}
      style={{
        border: highlight
          ? '1px solid rgba(97,95,255,0.50)'
          : '1px solid var(--border)',
        boxShadow: highlight
          ? '0 2px 12px rgba(0,0,0,0.30), 0 0 0 1px rgba(97,95,255,0.15)'
          : '0 2px 12px rgba(0,0,0,0.20)',
      }}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>

      <div className="flex items-end gap-1.5">
        <span className="metric-value text-foreground">{value}</span>
        {unit && (
          <span className="text-sm font-medium text-muted-foreground mb-0.5">{unit}</span>
        )}
      </div>

      {(delta !== undefined || deltaLabel) && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-semibold',
            isGood === true && 'text-[#10B981]',
            isGood === false && 'text-[#EF4444]',
            isGood === null && 'text-muted-foreground',
          )}
        >
          {trend && <TrendIcon className="w-3.5 h-3.5" />}
          <span>{deltaLabel ?? `${delta > 0 ? '+' : ''}${delta}`}</span>
        </div>
      )}

      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  )
}
