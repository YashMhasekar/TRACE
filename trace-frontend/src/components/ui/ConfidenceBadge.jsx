import { cn } from '@/lib/utils'

/**
 * Confidence badge using TRACE brand status colors.
 * @param {{ value: number, className?: string, showLabel?: boolean }} props
 */
export function ConfidenceBadge({ value, className, showLabel = true }) {
  const level = value >= 90 ? 'high' : value >= 75 ? 'medium' : 'low'

  // Use inline styles so they work in both light and dark without
  // needing Tailwind dark: variants for every colour combination.
  const styleMap = {
    high: {
      background: 'rgba(16,185,129,0.12)',
      color: '#10B981',
      border: '1px solid rgba(16,185,129,0.30)',
    },
    medium: {
      background: 'rgba(245,158,11,0.12)',
      color: '#F59E0B',
      border: '1px solid rgba(245,158,11,0.30)',
    },
    low: {
      background: 'rgba(239,68,68,0.12)',
      color: '#EF4444',
      border: '1px solid rgba(239,68,68,0.30)',
    },
  }

  const labels = { high: 'High', medium: 'Medium', low: 'Low' }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        className,
      )}
      style={styleMap[level]}
      title={`Model attribution confidence: ${value}% (${labels[level]}). Not a causal claim.`}
    >
      {value}%{showLabel && ` ${labels[level]}`}
    </span>
  )
}
