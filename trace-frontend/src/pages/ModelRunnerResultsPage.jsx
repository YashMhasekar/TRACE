/**
 * ModelRunnerResultsPage.jsx
 * Phase 3: Completion screen.
 *
 * Shows full analysis results:
 *   - Hero stats (expected, actual, gap, episodes)
 *   - Variance summary
 *   - Attribution chart (bar bars)
 *   - Recoverability breakdown
 *   - Recommendations list
 *   - Commercial impact (if tariff provided)
 *   - "Open Investigation" CTA → sets activePlantId context + navigates to /
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  CheckCircle2, Loader2, AlertCircle, RefreshCw,
  ExternalLink, ChevronRight, Zap, ArrowRight, TrendingDown,
  BarChart3, AlertTriangle, History,
} from 'lucide-react'
import { fetchResults } from '@/api/modelRunnerApi'
import { usePlantContext } from '@/contexts/PlantContext'
import { HistoryDrawer } from '@/components/model-runner/HistoryDrawer'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals })
}

// ── Sub-components ─────────────────────────────────────────────────────────
function HeroStat({ label, value, unit, sub, highlight }) {
  return (
    <div className={cn(
      'rounded-xl border px-5 py-4',
      highlight ? 'border-primary/30 bg-primary/6' : 'border-border bg-card',
    )}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function AttributionBar({ label, lossKwh, lossPct, confidence, controllable }) {
  const pct = Math.max(0, Math.min(100, lossPct ?? 0))
  const color =
    controllable ? 'bg-primary' :
      label?.includes('Environmental') ? 'bg-sky-500' :
        label?.includes('Data') ? 'bg-amber-400' : 'bg-muted-foreground/40'

  return (
    <div className="py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {controllable && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">CONTROLLABLE</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-right">
          <span className="text-xs text-muted-foreground">{fmt(lossKwh)} kWh</span>
          <span className="text-sm font-bold text-foreground w-10">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          Evidence confidence: <span className={cn(
            'font-semibold',
            confidence === 'HIGH' ? 'text-emerald-500' : confidence === 'MEDIUM' ? 'text-amber-500' : 'text-muted-foreground',
          )}>{confidence}</span>
        </span>
      </div>
    </div>
  )
}

function RecoverabilityBlock({ label, kwh, total, color }) {
  const pct = total > 0 ? (kwh / total) * 100 : 0
  return (
    <div className={cn('rounded-xl border p-4', color)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{fmt(kwh)} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
      <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% of total loss</p>
    </div>
  )
}

function RecommendationCard({ rec, rank }) {
  const PRIORITY_STYLE = {
    HIGH: 'border-l-red-500/60 bg-red-500/4',
    MEDIUM: 'border-l-amber-400/60 bg-amber-400/4',
    LOW: 'border-l-border bg-card',
    CRITICAL: 'border-l-red-600/80 bg-red-600/6',
  }
  return (
    <div className={cn('rounded-lg border border-border border-l-4 px-4 py-3', PRIORITY_STYLE[rec.priority] ?? 'border-l-border bg-card')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{rank}</span>
          <p className="text-sm font-semibold text-foreground">{rec.label}</p>
        </div>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0',
          rec.priority === 'HIGH' || rec.priority === 'CRITICAL' ? 'bg-red-500/15 text-red-500' :
            rec.priority === 'MEDIUM' ? 'bg-amber-400/15 text-amber-500' : 'bg-muted text-muted-foreground',
        )}>{rec.priority}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 ml-7">{rec.action}</p>
      <div className="flex gap-4 mt-2 ml-7">
        <span className="text-[11px] text-foreground">Loss: <strong>{fmt(rec.loss_kwh)} kWh</strong></span>
        {rec.recoverable_kwh > 0 && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Recovery potential: <strong>{fmt(rec.recoverable_kwh)} kWh</strong>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export function ModelRunnerResultsPage() {
  const { analysisId } = useParams()
  const navigate = useNavigate()
  const { selectPlant } = usePlantContext()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchResults(analysisId)
        if (!cancelled) {
          if (res) setData(res)
          else setError('Analysis still running — please wait.')
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [analysisId])

  // "Open Investigation" — sets PLANT-002 as active (real PVDAQ data) and navigates
  const handleOpenInvestigation = () => {
    // The uploaded analysis becomes the active investigation context.
    // For now we navigate to Overview with the existing plant.
    // In a full multi-plant system, you'd persist the analysis to a plant_id first.
    selectPlant('PLANT-002')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading results…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-muted-foreground">{error ?? 'Failed to load results'}</p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/model-runner')} className="text-xs text-primary hover:underline">
            Back to Model Runner
          </button>
          <button onClick={() => navigate(`/model-runner/live/${analysisId}`)} className="text-xs text-primary hover:underline">
            View Live Pipeline
          </button>
        </div>
      </div>
    )
  }

  const r = data.results ?? {}
  const perf = r.performance ?? {}
  const attribution = r.attribution ?? []
  const recov = r.recoverability ?? {}
  const recs = r.recommendations ?? []
  const commercial = r.commercial
  const evidence = r.evidence ?? []
  const recurrence = r.recurrence ?? []
  const model = r.model ?? {}

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* ── Completion hero ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">TRACE Investigation Complete</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {r.plant_name || r.dataset_filename} · {r.period}
              </p>
            </div>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted shrink-0"
          >
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Analysis ID */}
        <div className="mt-4 flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Analysis ID</p>
          <code className="text-xs font-mono text-foreground bg-muted/60 px-2 py-0.5 rounded">{analysisId}</code>
        </div>

        {/* Summary bullets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Observations', value: fmt(r.data_quality?.total_rows) },
            { label: 'Variance', value: `${fmt(perf.variance_kwh)} kWh` },
            { label: 'Episodes', value: fmt(r.total_episodes) },
            { label: 'Contributors', value: fmt(attribution.length) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={handleOpenInvestigation}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 shadow-sm transition-all"
          >
            <Zap className="w-4 h-4" /> Open Investigation <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/model-runner/live/${analysisId}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            View Pipeline Details
          </button>
          <button
            onClick={() => navigate('/model-runner')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Run Another Dataset
          </button>
        </div>
      </div>

      {/* ── Performance KPIs ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-muted-foreground" /> Performance Summary
        </h2>

        {/* Overperformance notice */}
        {perf.overperformance && (
          <div className="mb-3 flex items-start gap-2 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/6">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Period overperformance — actual exceeded model expectation
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The plant generated more than the model predicted. Episode losses below are
                localised underperformance intervals, not a net period deficit.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <HeroStat label="Expected Generation" value={fmt(perf.expected_kwh / 1000, 2)} unit="MWh" sub={`Ref: ${r.ref_period}`} />
          <HeroStat label="Actual Generation" value={fmt(perf.actual_kwh / 1000, 2)} unit="MWh" sub={`Eval: ${r.eval_period}`} />
          {perf.overperformance ? (
            <HeroStat
              label="Episode Loss"
              value={fmt(perf.episode_total_loss_kwh)}
              unit="kWh"
              sub="Local underperformance episodes"
              highlight
            />
          ) : (
            <HeroStat
              label="Performance Gap"
              value={fmt(perf.variance_kwh)}
              unit="kWh"
              sub={`${perf.variance_pct?.toFixed(2)}% below expected`}
              highlight
            />
          )}
        </div>

        {/* Visual gap bar */}
        <div className="mt-4 rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Expected</span>
            <span className="text-xs font-semibold text-foreground">{fmt(perf.expected_kwh)} kWh</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden mb-2">
            <div className="h-full rounded-full bg-sky-500/40" style={{ width: '100%' }} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Actual</span>
            <span className="text-xs font-semibold text-foreground">{fmt(perf.actual_kwh)} kWh</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000",
                perf.overperformance ? "bg-emerald-500" : "bg-emerald-500/70")}
              style={{
                width: `${perf.expected_kwh > 0
                  ? Math.min((perf.actual_kwh / perf.expected_kwh) * 100, 105)
                  : 0}%`
              }}
            />
          </div>
          <div className="flex justify-end mt-2">
            {perf.overperformance ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ {fmt(Math.abs(perf.variance_kwh))} kWh above expected
                (episode losses: {fmt(perf.episode_total_loss_kwh)} kWh)
              </span>
            ) : (
              <span className="text-xs font-semibold text-primary">
                ↓ {fmt(perf.variance_kwh)} kWh gap ({perf.variance_pct?.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Model info ────────────────────────────────────────────────── */}
      {model.eval_r2 != null && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" /> Expected-Generation Model
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Model', value: 'Gradient Boosting' },
              { label: 'Training obs.', value: fmt(model.training_obs) },
              { label: 'Validation R²', value: model.eval_r2?.toFixed(4) },
              { label: 'Validation nMAE', value: `${model.eval_nmae_pct?.toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Feature importance */}
          {model.feature_importance && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Tree-based feature importance (not causal influence)</p>
              {Object.entries(model.feature_importance).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 mb-1.5">
                  <span className="text-xs text-muted-foreground flex-1 truncate">{k}</span>
                  <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${v * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-10 text-right">{(v * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Attribution ───────────────────────────────────────────────── */}
      {attribution.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">Why Did We Miss?</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Evidence-weighted attribution of {fmt(perf.episode_total_loss_kwh ?? Math.abs(perf.variance_kwh))} kWh
            across {r.total_episodes} episodes. Allocated contribution — not causal proof.
          </p>
          {attribution.map((a) => (
            <AttributionBar
              key={a.category}
              label={a.label}
              lossKwh={a.loss_kwh}
              lossPct={a.loss_pct}
              confidence={a.confidence}
              controllable={a.controllable}
            />
          ))}
        </div>
      )}

      {/* ── Recurrence ────────────────────────────────────────────────── */}
      {recurrence.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">Recurrence Analysis</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {r.total_episodes} detected episodes. Pattern classification requires caution — "potentially structural" ≠ proven root cause.
          </p>
          <div className="space-y-3">
            {recurrence.map((rec) => (
              <div key={rec.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rec.episode_count} episodes · {rec.frequency_pct?.toFixed(1)}% of total ·{' '}
                    {fmt(rec.total_loss_kwh)} kWh cumulative
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ml-3',
                  rec.recurrence_class === 'POTENTIALLY_STRUCTURAL' ? 'bg-amber-400/15 text-amber-500' :
                    rec.recurrence_class === 'REPEATED' ? 'bg-orange-400/15 text-orange-500' :
                      'bg-muted text-muted-foreground',
                )}>
                  {rec.recurrence_class?.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recoverability ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-1">Loss Classification</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Episode loss basis: <strong>{fmt(recov.total_loss_kwh)} kWh</strong> across {r.total_episodes} episodes.
          {recov.overperformance_note && (
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">{recov.overperformance_note}</span>
          )}
          {' '}Recovery factor: {recov.recovery_factor_pct ?? 60}% applied to controllable loss.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RecoverabilityBlock
            label="Recoverable"
            kwh={recov.recoverable_kwh}
            total={recov.total_loss_kwh}
            color="border-emerald-500/20 bg-emerald-500/5"
          />
          <RecoverabilityBlock
            label="Unavoidable"
            kwh={recov.unavoidable_kwh}
            total={recov.total_loss_kwh}
            color="border-sky-500/20 bg-sky-500/5"
          />
          <RecoverabilityBlock
            label="Uncertain"
            kwh={recov.uncertain_kwh}
            total={recov.total_loss_kwh}
            color="border-border bg-muted/20"
          />
        </div>
      </div>

      {/* ── Commercial impact ─────────────────────────────────────────── */}
      {commercial ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Commercial Impact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Energy Loss</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmt(commercial.total_loss_kwh)} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Estimated Revenue Impact</p>
              <p className="text-2xl font-bold text-red-500 mt-1">${fmt(commercial.revenue_impact)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                @ ${commercial.tariff_usd_per_kwh}/kWh · settlement {commercial.settlement_factor}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Potentially Recoverable</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${fmt(commercial.recoverable_revenue)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">Commercial impact unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a tariff (USD/kWh) in the analysis configuration to calculate revenue impact.
          </p>
        </div>
      )}

      {/* ── Recommendations ───────────────────────────────────────────── */}
      {recs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">Recommended Actions</h2>
          <div className="space-y-2">
            {recs.map((rec, i) => (
              <RecommendationCard key={rec.category ?? i} rec={rec} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Evidence sample ───────────────────────────────────────────── */}
      {evidence.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Top Evidence Items</h2>
            <Link to="/evidence" className="text-xs text-primary hover:underline flex items-center gap-1">
              Full evidence explorer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {evidence.slice(0, 5).map((ev) => (
              <div key={ev.id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{ev.id}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                        ev.confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-600' :
                          ev.confidence === 'MEDIUM' ? 'bg-amber-400/15 text-amber-500' :
                            'bg-muted text-muted-foreground',
                      )}>
                        {ev.confidence}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">{ev.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{ev.proof_statement}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{fmt(ev.variance_kwh)} kWh</p>
                    <p className="text-[10px] text-muted-foreground">{ev.duration_minutes} min</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom CTAs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <button
          onClick={handleOpenInvestigation}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-sm transition-all"
        >
          <Zap className="w-4 h-4" /> Open Investigation <ChevronRight className="w-4 h-4" />
        </button>
        <Link
          to="/simulator"
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Recovery Simulator
        </Link>
        <button
          onClick={() => navigate('/model-runner')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Analyse Another Dataset
        </button>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(run) => {
          if (run.status === 'completed') navigate(`/model-runner/results/${run.analysis_id}`)
          else navigate(`/model-runner/live/${run.analysis_id}`)
        }}
      />
    </div>
  )
}
