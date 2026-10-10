import { cn } from '@/lib/utils'
import { Eye, Wrench, RotateCcw, X, Check } from 'lucide-react'

/**
 * Displays the TRACE "three truths" classification:
 * Explainable / Controllable / Recoverable.
 *
 * @param {{
 *   explainable: boolean,
 *   controllable: boolean,
 *   recoverable: boolean,
 *   size?: 'sm' | 'md',
 *   className?: string,
 * }} props
 */
export function ThreeTruths({ explainable, controllable, recoverable, size = 'md', className }) {
  const items = [
    { label: 'Explainable', value: explainable, Icon: Eye },
    { label: 'Controllable', value: controllable, Icon: Wrench },
    { label: 'Recoverable', value: recoverable, Icon: RotateCcw },
  ]

  return (
    <div className={cn('flex gap-2', size === 'sm' && 'gap-1.5', className)}>
      {items.map(({ label, value, Icon }) => (
        <div
          key={label}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
            value
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-muted border-border text-muted-foreground',
            size === 'sm' && 'px-2 py-1',
          )}
          title={`${label}: ${value ? 'Yes' : 'No'}`}
        >
          <Icon className={cn('w-3.5 h-3.5', size === 'sm' && 'w-3 h-3')} />
          <span className={cn('text-xs font-medium', size === 'sm' && 'text-[11px]')}>
            {label}
          </span>
          {value
            ? <Check className={cn('w-3 h-3', size === 'sm' && 'w-2.5 h-2.5')} />
            : <X className={cn('w-3 h-3', size === 'sm' && 'w-2.5 h-2.5')} />
          }
        </div>
      ))}
    </div>
  )
}
