/**
 * DatasetCard.jsx
 * Shows detected dataset metadata after upload:
 * row count, date range, interval, detected columns.
 */
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const FIELD_LABELS = {
  timestamp:    'Timestamp',
  poa:          'POA Irradiance',
  module_temp:  'Module Temperature',
  dc_power:     'DC Power',
  ac_power:     'AC Power',
  ambient_temp: 'Ambient Temperature',
  pr:           'Performance Ratio',
}

const FIELD_NOTES = {
  poa:     'Required for expected-generation model',
  module_temp: 'Required for expected-generation model',
  ac_power:    'Required for variance and attribution',
  dc_power:    'Enables DC/AC evidence patterns',
  pr:          'Enables performance-ratio evidence',
}

export function DatasetCard({ preview }) {
  if (!preview) return null

  const { filename, rows, columns, period_label, interval_minutes, detected_fields = [], quality = {} } = preview

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <FileText className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Dataset Detected</p>
          <p className="font-semibold text-foreground truncate">{filename}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rows',     value: rows?.toLocaleString() ?? '—' },
          { label: 'Columns',  value: columns ?? '—' },
          { label: 'Period',   value: period_label ?? '—' },
          { label: 'Interval', value: interval_minutes ? `${interval_minutes} min` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Field detection */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detected Fields</p>
        <div className="space-y-1.5">
          {detected_fields.map((f) => (
            <div key={f.field} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {f.status === 'found' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : f.required ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className={cn(
                  'text-xs font-medium truncate',
                  f.status === 'found' ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {FIELD_LABELS[f.field] ?? f.field}
                </span>
                {f.required && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold shrink-0">
                    REQUIRED
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                {f.csv_col ? (
                  <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px] block">
                    {f.csv_col}
                  </span>
                ) : (
                  <span className={cn(
                    'text-[11px]',
                    f.required ? 'text-red-500 font-medium' : 'text-amber-500',
                  )}>
                    {f.required ? 'Not found' : 'Optional — not found'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes on missing optional fields */}
      {detected_fields.filter((f) => f.status !== 'found' && !f.required).map((f) => (
        <div key={f.field} className="flex gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {FIELD_LABELS[f.field]} not found
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {FIELD_NOTES[f.field] ?? 'TRACE will continue, but this evidence type will be unavailable.'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
