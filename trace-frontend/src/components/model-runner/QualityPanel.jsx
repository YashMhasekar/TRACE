/**
 * QualityPanel.jsx
 * Shows data quality checks before allowing analysis to run.
 * Green = pass, amber = warning, red = blocking error.
 */
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function QualityRow({ label, value, status }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        {status === 'pass' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        {status === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        {status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
        <span className={cn(
          'text-xs',
          status === 'error' ? 'text-red-500 font-medium' :
            status === 'warn' ? 'text-amber-600 dark:text-amber-400' :
              'text-foreground',
        )}>
          {label}
        </span>
      </div>
      <span className={cn(
        'text-xs font-semibold tabular-nums',
        status === 'pass' ? 'text-emerald-600 dark:text-emerald-400' :
          status === 'warn' ? 'text-amber-600 dark:text-amber-400' :
            'text-red-500',
      )}>
        {value}
      </span>
    </div>
  )
}

export function QualityPanel({ quality = {}, totalRows = 0 }) {
  const {
    valid_rows = 0,
    missing_ts = 0,
    missing_ac = 0,
    missing_poa = 0,
    duplicate_rows = 0,
    sampling_pct,
    power_range_ok,
  } = quality

  const rows = [
    {
      label: 'Rows with AC power',
      value: valid_rows.toLocaleString(),
      status: valid_rows >= 100 ? 'pass' : 'error',
    },
    {
      label: 'Missing timestamps',
      value: missing_ts,
      status: missing_ts === 0 ? 'pass' : missing_ts < totalRows * 0.02 ? 'warn' : 'error',
    },
    {
      label: 'Missing AC power',
      value: missing_ac,
      status: missing_ac === 0 ? 'pass' : missing_ac < totalRows * 0.05 ? 'warn' : 'error',
    },
    {
      label: 'Missing POA irradiance',
      value: missing_poa,
      status: missing_poa === 0 ? 'pass' : 'warn',
    },
    {
      label: 'Duplicate rows',
      value: duplicate_rows,
      status: duplicate_rows === 0 ? 'pass' : duplicate_rows < 20 ? 'warn' : 'error',
    },
    {
      label: 'Sampling consistency',
      value: sampling_pct != null ? `${sampling_pct}%` : '—',
      status: sampling_pct == null ? 'warn' : sampling_pct >= 95 ? 'pass' : 'warn',
    },
    {
      label: 'Power range validation',
      value: power_range_ok == null ? '—' : power_range_ok ? 'PASS' : 'WARN',
      status: power_range_ok == null ? 'warn' : power_range_ok ? 'pass' : 'warn',
    },
  ]

  const hasError = rows.some((r) => r.status === 'error')
  const hasWarn = rows.some((r) => r.status === 'warn')

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Quality</p>
        {hasError ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 font-semibold">ISSUES FOUND</span>
        ) : hasWarn ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-500 font-semibold">WARNINGS</span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">ALL PASS</span>
        )}
      </div>

      <div>
        {rows.map((r) => (
          <QualityRow key={r.label} label={r.label} value={r.value} status={r.status} />
        ))}
      </div>
    </div>
  )
}
