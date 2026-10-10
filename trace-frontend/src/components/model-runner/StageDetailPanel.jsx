/**
 * StageDetailPanel.jsx
 * Right-side panel showing metrics and context for the active stage.
 * Updates whenever currentStage or stages data changes.
 */
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, X, Loader2, Info } from 'lucide-react'

const STAGE_DESCRIPTIONS = {
  dataset_ingestion: 'Loading CSV into memory and counting rows and columns.',
  data_quality: 'Validating completeness, duplicate rows, sampling consistency, and value ranges.',
  column_mapping: 'Matching uploaded columns to TRACE internal field names. Required: timestamp, POA, module temp, AC power.',
  normalization: 'Standardising column names, parsing timestamps, converting units, splitting reference/evaluation periods.',
  expected_generation: 'Training GradientBoostingRegressor on the quality-filtered reference period, then predicting expected AC power for the evaluation period.',
  variance: 'Subtracting expected from actual to compute the performance gap at each 15-minute interval.',
  attribution: 'Classifying each significant variance interval into evidence categories: Equipment, Environmental, Data Quality, or Unexplained.',
  evidence: 'Building the DC/AC/POA evidence chain for each episode — linking signals to potential causes.',
  recurrence: 'Clustering episodes across months to identify potentially structural vs isolated loss patterns.',
  recoverability: 'Classifying loss as controllable, recoverable, unavoidable, or uncertain. Estimating recovery potential.',
  recommendations: 'Generating prioritised action list from attribution, recurrence, and recoverability results.',
}

const MODEL_SAFEGUARDS = [
  'Night-time zero generation (POA < 10 W/m²)',
  'Capacity clipping at nameplate (720.72 kW)',
  'Invalid sensor values excluded from training',
  'Reference period quality-filtered before training',
]

function MetricRow({ label, value, unit, highlight }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', highlight ? 'text-primary' : 'text-foreground')}>
        {value}{unit ? <span className="text-muted-foreground font-normal ml-0.5">{unit}</span> : null}
      </span>
    </div>
  )
}

function WarningBadge({ msg }) {
  return (
    <div className="flex gap-2 px-2.5 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <p className="text-[11px] leading-relaxed">{msg}</p>
    </div>
  )
}

function renderMetrics(stageId, metrics) {
  if (!metrics) return null

  switch (stageId) {
    case 'dataset_ingestion':
      return (
        <>
          <MetricRow label="Rows loaded" value={metrics.rows?.toLocaleString() ?? '—'} />
          <MetricRow label="Columns" value={metrics.columns ?? '—'} />
        </>
      )

    case 'data_quality': {
      // Guard: if metrics hasn't been written yet (stage still running), all
      // values are undefined — show '—' rather than misleading 0 / WARN.
      const dqReady = metrics.total_rows != null
      return (
        <>
          <MetricRow label="Total rows" value={dqReady ? metrics.total_rows?.toLocaleString() : '—'} />
          <MetricRow label="Valid rows" value={dqReady ? metrics.valid_rows?.toLocaleString() : '—'} highlight />
          <MetricRow label="Missing AC" value={dqReady ? (metrics.missing_ac ?? 0) : '—'} />
          <MetricRow label="Missing POA" value={dqReady ? (metrics.missing_poa ?? 0) : '—'} />
          <MetricRow label="Duplicate rows" value={dqReady ? (metrics.duplicate_rows ?? 0) : '—'} />
          <MetricRow label="Interval" value={dqReady ? (metrics.interval_minutes ?? '?') : '—'} unit={dqReady && metrics.interval_minutes != null ? 'min' : undefined} />
          <MetricRow label="Sampling OK" value={!dqReady ? '—' : metrics.sampling_ok ? 'PASS' : 'WARN'} />
          <MetricRow label="Fields detected" value={dqReady ? (metrics.detected_fields ?? []).length : '—'} />
        </>
      )
    }

    case 'column_mapping':
      return metrics.mapping
        ? Object.entries(metrics.mapping).map(([field, col]) => (
          <MetricRow key={field} label={field} value={col} />
        ))
        : null

    case 'normalization':
      return (
        <>
          <MetricRow label="Date range" value={metrics.date_range ?? '—'} />
          <MetricRow label="Reference period" value={metrics.ref_period ?? '—'} />
          <MetricRow label="Evaluation start" value={metrics.eval_period_start ?? '—'} />
          <MetricRow label="Reference rows" value={metrics.reference_rows?.toLocaleString() ?? '—'} />
          <MetricRow label="Evaluation rows" value={metrics.evaluation_rows?.toLocaleString() ?? '—'} />
        </>
      )

    case 'expected_generation':
      return (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Training</p>
          <MetricRow label="Observations" value={metrics.training_obs?.toLocaleString() ?? '—'} />
          <MetricRow label="MAE" value={metrics.training_mae_kw?.toFixed(2) ?? '—'} unit="kW" />
          <MetricRow label="RMSE" value={metrics.training_rmse_kw?.toFixed(2) ?? '—'} unit="kW" />
          <MetricRow label="R²" value={metrics.training_r2?.toFixed(4) ?? '—'} highlight />
          <MetricRow label="nMAE" value={metrics.training_nmae_pct?.toFixed(1) ?? '—'} unit="%" />
          <div className="mt-3 mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Validation (holdout)</p>
          </div>
          <MetricRow label="Observations" value={metrics.eval_obs?.toLocaleString() ?? '—'} />
          <MetricRow label="R²" value={metrics.eval_r2?.toFixed(4) ?? '—'} highlight />
          <MetricRow label="nMAE" value={metrics.eval_nmae_pct?.toFixed(1) ?? '—'} unit="%" />
          <div className="mt-3 mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tree-based feature importance</p>
          </div>
          {metrics.feature_importance && Object.entries(metrics.feature_importance).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground flex-1 truncate">{k}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${v * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground w-8 text-right">{(v * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Domain safeguards</p>
            {MODEL_SAFEGUARDS.map((s) => (
              <div key={s} className="flex gap-1.5 items-start mb-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-muted-foreground">{s}</span>
              </div>
            ))}
          </div>
        </>
      )

    case 'variance': {
      const vReady = metrics.expected_kwh != null
      return (
        <>
          <MetricRow label="Expected" value={vReady ? (metrics.expected_kwh / 1000).toFixed(2) : '—'} unit={vReady ? 'MWh' : undefined} />
          <MetricRow label="Actual" value={vReady ? (metrics.actual_kwh / 1000).toFixed(2) : '—'} unit={vReady ? 'MWh' : undefined} />
          <MetricRow label="Gap" value={vReady ? (metrics.variance_kwh?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—') : '—'} unit={vReady ? 'kWh' : undefined} highlight />
          <MetricRow label="Gap %" value={vReady ? (metrics.variance_pct?.toFixed(2) ?? '—') : '—'} unit={vReady ? '%' : undefined} />
          <MetricRow label="Significant intervals" value={metrics.significant_intervals ?? '—'} />
        </>
      )
    }

    case 'attribution':
      return (
        <>
          <MetricRow label="Episodes identified" value={metrics.total_episodes ?? '—'} highlight />
          <MetricRow label="Total attributed (kWh)" value={metrics.total_attributed_kwh?.toFixed(0) ?? '—'} />
          <MetricRow label="Unexplained (kWh)" value={metrics.unexplained_kwh?.toFixed(0) ?? '—'} />
          {(metrics.attribution ?? []).map((a) => (
            <div key={a.category} className="py-1.5 border-b border-border/20 last:border-0">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{a.label}</span>
                <span className="text-[11px] font-semibold text-foreground">{a.loss_pct?.toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${a.loss_pct}%` }} />
              </div>
            </div>
          ))}
        </>
      )

    case 'evidence':
      return (
        <>
          <MetricRow label="Evidence items" value={metrics.evidence_count ?? '—'} />
          <MetricRow label="High confidence" value={metrics.high_confidence ?? '—'} highlight />
        </>
      )

    case 'recurrence':
      return (
        <>
          <MetricRow label="Total episodes" value={metrics.total_episodes ?? '—'} />
          {(metrics.summary ?? []).map((r) => (
            <div key={r.category} className="py-1.5 border-b border-border/20 last:border-0">
              <div className="flex justify-between">
                <span className="text-[11px] text-muted-foreground">{r.label}</span>
                <span className="text-[11px] font-semibold">{r.episode_count} eps</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {r.recurrence_class.replace(/_/g, ' ')} · {r.frequency_pct?.toFixed(1)}%
              </p>
            </div>
          ))}
        </>
      )

    case 'recoverability':
      return (
        <>
          <MetricRow label="Total loss" value={metrics.total_loss_kwh?.toFixed(0) ?? '—'} unit="kWh" />
          <MetricRow label="Controllable" value={metrics.controllable_kwh?.toFixed(0) ?? '—'} unit="kWh" />
          <MetricRow label="Recoverable" value={metrics.recoverable_kwh?.toFixed(0) ?? '—'} unit="kWh" highlight />
          <MetricRow label="Unavoidable" value={metrics.unavoidable_kwh?.toFixed(0) ?? '—'} unit="kWh" />
          <MetricRow label="Uncertain" value={metrics.uncertain_kwh?.toFixed(0) ?? '—'} unit="kWh" />
          {metrics.commercial && (
            <>
              <div className="my-2 border-t border-border/30" />
              <MetricRow label="Revenue impact" value={`$${metrics.commercial.revenue_impact?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <MetricRow label="Recoverable rev." value={`$${metrics.commercial.recoverable_revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} highlight />
            </>
          )}
        </>
      )

    case 'recommendations':
      return (
        <MetricRow label="Actions generated" value={metrics.count ?? '—'} highlight />
      )

    default:
      return null
  }
}

export function StageDetailPanel({ currentStageId, stages, status }) {
  // Find the stage data for the current/last-active stage
  const stageData = stages?.find((s) => s.stage_id === currentStageId) ?? null
  const metrics = stageData?.metrics ?? {}
  const warnings = stageData?.warnings ?? []
  const stageStatus = stageData?.status ?? (status === 'running' ? 'running' : 'queued')
  const description = STAGE_DESCRIPTIONS[currentStageId] ?? ''

  if (!currentStageId || currentStageId === 'queued') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-10 h-10 rounded-full bg-muted/40 border border-border flex items-center justify-center mb-3">
          <Info className="w-5 h-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">Pipeline stage details will appear here as each stage runs.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stage header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          {stageStatus === 'running' && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          )}
          {stageStatus === 'completed' && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}
          {stageStatus === 'warning' && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          {stageStatus === 'failed' && (
            <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            {currentStageId.replace(/_/g, ' ')}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-3 pt-3 space-y-1.5 shrink-0">
          {warnings.map((w, i) => <WarningBadge key={i} msg={w} />)}
        </div>
      )}

      {/* Metrics */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {stageStatus === 'running' && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-primary/8 border border-primary/20">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            <span className="text-xs text-primary font-medium">Processing…</span>
          </div>
        )}
        {renderMetrics(currentStageId, metrics)}

        {stageStatus === 'failed' && metrics?.error && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/8 border border-red-500/20">
            <p className="text-xs font-semibold text-red-500 mb-1">Error</p>
            <p className="text-[11px] text-muted-foreground">{metrics.error}</p>
            {metrics.detail && (
              <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">{metrics.detail}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
