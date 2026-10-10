import { useState } from 'react'
import { Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   overall: number,
 *   completeness?: number,
 *   timestampQuality?: number,
 *   duplicateRate?: number,
 *   evidenceCoverage?: number,
 * }} props
 */
export function DataQualityBadge({
  overall,
  completeness,
  timestampQuality,
  duplicateRate,
  evidenceCoverage,
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
          overall >= 90
            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
            : overall >= 75
            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100',
        )}
        aria-expanded={open}
        aria-label="View data quality breakdown"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Data Quality: {overall}%</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 z-50 bg-popover border border-border rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Data Quality</p>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Completeness', value: completeness, suffix: '%' },
                { label: 'Timestamp Quality', value: timestampQuality, suffix: '%' },
                { label: 'Duplicate Rate', value: duplicateRate, suffix: '%', lowerBetter: true },
                { label: 'Evidence Coverage', value: evidenceCoverage, suffix: '%' },
              ].map(({ label, value, suffix, lowerBetter }) => (
                value !== undefined && (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={cn(
                      'text-xs font-semibold',
                      lowerBetter
                        ? value < 1 ? 'text-green-600' : 'text-amber-600'
                        : value >= 90 ? 'text-green-600' : 'text-amber-600',
                    )}>
                      {value}{suffix}
                    </span>
                  </div>
                )
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
              Data quality assessment covers May 2026 analysis period.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
