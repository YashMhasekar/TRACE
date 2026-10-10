import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, FlaskConical, Activity, AlertCircle } from 'lucide-react'
import { useOverview, useImpactTree } from '@/hooks/useTrace'
import { MetricCard } from '@/components/ui/MetricCard'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { ImpactTree } from '@/components/impact-tree/ImpactTree'
import { cn } from '@/lib/utils'

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function OverviewPage() {
  const overviewQuery = useOverview()
  const treeQuery = useImpactTree()

  if (overviewQuery.isLoading || treeQuery.isLoading) {
    return <LoadingState message="Loading overview…" />
  }

  if (overviewQuery.isError || treeQuery.isError) {
    return <ErrorState message="Failed to load overview data." />
  }

  const { plant, period, performance, dataQuality, topRecoveryOpportunities } = overviewQuery.data
  const { nodes, edges } = treeQuery.data

  // Support both old (GWh) and new (kWh) field names from overview.json
  const expectedKwh = performance.expectedKwh ?? (performance.expectedGwh * 1000)
  const actualKwh = performance.actualKwh ?? (performance.actualGwh * 1000)
  const varianceKwh = performance.varianceKwh ?? (performance.varianceGwh * 1000)
  const variancePct = performance.variancePct
  const recoverableKwh = performance.recoverableKwh ?? (performance.recoverableGwh * 1000)

  return (
    <div className="space-y-8">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="text-center py-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#615FFF' }}>
          NREL PVDAQ System 1430 · Jan–Feb 2017
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">TRACE</h1>
        <p className="text-lg text-muted-foreground font-medium mb-1">
          Performance Attribution & Recovery Intelligence
        </p>
        <p className="text-xl font-semibold text-foreground mt-4 mb-2">
          "Why did we miss?"
        </p>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Trace every performance gap from expected output to evidence, recurrence, and recovery.
        </p>

        {/* Verified model metrics banner */}
        <div className="inline-flex items-center gap-6 mt-5 px-5 py-2.5 rounded-[10px] border"
          style={{ borderColor: 'rgba(97,95,255,0.25)', background: 'rgba(97,95,255,0.06)' }}>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Test MAE</p>
            <p className="text-base font-bold" style={{ color: '#615FFF' }}>
              {performance.testMAE_kW ?? '17.23'} kW
            </p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Test R²</p>
            <p className="text-base font-bold" style={{ color: '#615FFF' }}>
              {performance.testR2 ?? '0.9089'}
            </p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Train MAE</p>
            <p className="text-base font-bold text-muted-foreground">
              {performance.trainMAE_kW ?? '11.60'} kW
            </p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Period</p>
            <p className="text-base font-bold text-foreground">{period}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Verified model metrics · Gradient Boosting Regressor · Temporal holdout
        </p>
      </section>

      {/* ── Key metrics ───────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Expected Generation"
            value={fmt(expectedKwh / 1000, 2)}
            unit="MWh"
            description={`${plant} · ${period}`}
          />
          <MetricCard
            label="Actual Generation"
            value={fmt(actualKwh / 1000, 2)}
            unit="MWh"
            trend="down"
            trendPositive={false}
          />
          <MetricCard
            label="Performance Gap"
            value={fmt(Math.abs(varianceKwh))}
            unit="kWh"
            deltaLabel={`${Math.abs(variancePct).toFixed(2)}% below expected`}
            trend="down"
            trendPositive={false}
            highlight
          />
          <MetricCard
            label="Recoverable Potential"
            value={fmt(recoverableKwh)}
            unit="kWh"
            deltaLabel={`${performance.recoverablePct?.toFixed(1) ?? '—'}% of gap`}
            trend="up"
            trendPositive
          />
        </div>

        {/* Attribution disclaimer per the presentation */}
        <div className="mt-3 flex items-start gap-2 px-4 py-2.5 rounded-[8px] border text-xs"
          style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)', color: '#B7B7B7' }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <span>
            Attribution is evidence-weighted and heuristic — not proof of physical causality.
            Commercial figures use synthetic assumptions (demonstration only).
          </span>
        </div>
      </section>

      {/* ── TRACE Impact Tree ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">TRACE Impact Tree</h2>
            <p className="text-sm text-muted-foreground">
              Interactive decomposition of the performance gap · Feb 2017 test period
            </p>
          </div>
        </div>
        <ImpactTree nodes={nodes} edges={edges} />
      </section>

      {/* ── Recovery opportunities ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Top Recovery Opportunities</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controllable causes ranked by recoverable potential · commercial figures synthetic
            </p>
          </div>
          <Link to="/simulator">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              Open Simulator
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topRecoveryOpportunities.map((opp) => {
            // Support both old (Gwh) and new (kWh) field names
            const lossVal = opp.lossKwh ?? (opp.lossGwh * 1000)
            const recovVal = opp.potentialRecoveryKwh ?? (opp.potentialRecoveryGwh * 1000)
            const revenueVal = opp.potentialRevenueSynthetic ?? opp.potentialRevenue
            return (
              <div
                key={opp.cause}
                className="rounded-[10px] border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      #{opp.rank} Priority
                    </p>
                    <h3 className="text-base font-bold text-foreground mt-0.5">{opp.cause}</h3>
                  </div>
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                  )}
                    style={{
                      background: opp.rank === 1 ? 'rgba(239,68,68,0.12)' :
                        opp.rank === 2 ? 'rgba(245,158,11,0.12)' :
                          'rgba(16,185,129,0.12)',
                      color: opp.rank === 1 ? '#EF4444' :
                        opp.rank === 2 ? '#F59E0B' :
                          '#10B981',
                    }}
                  >
                    {opp.rank}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Loss</span>
                    <span className="font-semibold text-xs">{fmt(lossVal)} kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Recoverable</span>
                    <span className="font-semibold text-xs" style={{ color: '#10B981' }}>
                      {fmt(recovVal)} kWh
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Revenue (synthetic)</span>
                    <span className="font-semibold text-xs" style={{ color: '#10B981' }}>
                      ${fmt(revenueVal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Recurrence</span>
                    <span className="font-medium text-xs">{opp.recurrence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Confidence</span>
                    <span className="font-semibold text-xs"
                      style={{ color: opp.confidence >= 90 ? '#10B981' : opp.confidence >= 80 ? '#F59E0B' : '#EF4444' }}>
                      {opp.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="text-center py-6">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/why-did-we-miss">
            <Button size="lg" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Investigate Why We Missed
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/model-runner">
            <Button size="lg" variant="outline" className="gap-2">
              <Activity className="w-4 h-4" />
              Run Model Runner
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
