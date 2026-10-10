/**
 * PipelineStage.jsx
 * A single card in the vertical pipeline. Shows status icon, label,
 * and a brief metric summary once completed. Clickable when done.
 */
import { cn } from '@/lib/utils'
import { Check, AlertTriangle, X, Loader2, Clock } from 'lucide-react'

const STAGE_META = {
  dataset_ingestion:   { label: 'Dataset Ingestion',      short: 'Loading CSV' },
  data_quality:        { label: 'Data Quality',           short: 'Validating data' },
  column_mapping:      { label: 'Column Mapping',         short: 'Detecting fields' },
  normalization:       { label: 'Normalization',          short: 'Standardising data' },
  expected_generation: { label: 'Expected Generation',    short: 'Training model' },
  variance:            { label: 'Variance Engine',        short: 'Calculating gap' },
  attribution:         { label: 'Attribution Engine',     short: 'Attributing losses' },
  evidence:            { label: 'Evidence Engine',        short: 'Building chain' },
  recurrence:          { label: 'Recurrence Engine',      short: 'Clustering episodes' },
  recoverability:      { label: 'Recoverability',         short: 'Estimating recovery' },
  recommendations:     { label: 'Recommendations',        short: 'Generating actions' },
}

function StatusIcon({ status, isCurrentRunning }) {
  if (status === 'completed')
    return <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.5} />
  if (status === 'warning')
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
  if (status === 'failed')
    return <X className="w-3.5 h-3.5 text-red-500" strokeWidth={2.5} />
  if (status === 'running')
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
  return <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
}

function metricSummary(stageId, metrics) {
  if (!metrics) return null
  switch (stageId) {
    case 'dataset_ingestion':
      return metrics.rows ? `${metrics.rows.toLocaleString()} rows` : null
    case 'data_quality':
      return metrics.valid_rows ? `${metrics.valid_rows.toLocaleString()} valid rows` : null
    case 'column_mapping':
      return metrics.mapping ? `${Object.keys(metrics.mapping).length} fields mapped` : null
    case 'normalization':
      return metrics.date_range ?? null
    case 'expected_generation':
      return metrics.eval_r2 != null ? `R² = ${metrics.eval_r2.toFixed(3)}` : null
    case 'variance':
      return metrics.variance_kwh != null
        ? `${metrics.variance_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh gap`
        : null
    case 'attribution':
      return metrics.total_episodes != null ? `${metrics.total_episodes} episodes` : null
    case 'evidence':
      return metrics.evidence_count != null ? `${metrics.evidence_count} items` : null
    case 'recurrence':
      return metrics.total_episodes != null ? `${metrics.total_episodes} episodes` : null
    case 'recoverability':
      return metrics.recoverable_kwh != null
        ? `${metrics.recoverable_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh recoverable`
        : null
    case 'recommendations':
      return metrics.count != null ? `${metrics.count} actions` : null
    default:
      return null
  }
}

export function PipelineStage({ stageId, status = 'queued', metrics, isActive, onClick }) {
  const meta    = STAGE_META[stageId] ?? { label: stageId, short: '' }
  const summary = metricSummary(stageId, metrics)
  const clickable = status === 'completed' || status === 'warning'

  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-200',
        // Active (currently running)
        isActive && status === 'running'
          ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/20'
          : '',
        // Completed / warning — clickable
        (status === 'completed' || status === 'warning') && !isActive
          ? 'border-border/60 bg-card hover:border-primary/30 hover:bg-accent/40 cursor-pointer'
          : '',
        // Active completed
        isActive && status === 'completed'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : '',
        // Failed
        status === 'failed'
          ? 'border-red-500/40 bg-red-500/5'
          : '',
        // Queued
        status === 'queued'
          ? 'border-border/30 bg-card/40 opacity-50 cursor-default'
          : '',
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      {/* Status dot */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border',
        status === 'completed' ? 'border-emerald-500/50 bg-emerald-500/10' : '',
        status === 'warning'   ? 'border-amber-400/50  bg-amber-400/10'   : '',
        status === 'failed'    ? 'border-red-500/50    bg-red-500/10'     : '',
        status === 'running'   ? 'border-primary/50    bg-primary/10'     : '',
        status === 'queued'    ? 'border-border/40     bg-muted/30'       : '',
      )}>
        <StatusIcon status={status} />
      </div>

      {/* Label + summary */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-semibold truncate',
          status === 'completed' || status === 'warning' ? 'text-foreground' : '',
          status === 'running'   ? 'text-primary'   : '',
          status === 'failed'    ? 'text-red-500'   : '',
          status === 'queued'    ? 'text-muted-foreground/50' : '',
        )}>
          {meta.label}
        </p>
        {summary && status !== 'queued' && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{summary}</p>
        )}
        {status === 'running' && (
          <p className="text-[10px] text-primary/70 mt-0.5">{meta.short}…</p>
        )}
      </div>

      {/* Warning badge */}
      {status === 'warning' && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-500 font-semibold shrink-0">
          WARN
        </span>
      )}
    </button>
  )
}
