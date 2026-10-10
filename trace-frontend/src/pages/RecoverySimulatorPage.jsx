import { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { useSimulationData, useSimulateRecovery } from '@/hooks/useTrace'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { AlertCircle, GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function RecoverySimulatorPage() {
  // ── All hooks must be called before any early return ──────
  const simDataQuery = useSimulationData()
  const simulateMutation = useSimulateRecovery()

  // Shared cross-app selection — pre-selects a cause if the user
  // navigated here from the Impact Tree / Waterfall with a selection active.
  const { selectedCauseId } = useImpactTree()

  // Local cause selection — initialise from shared context when available,
  // otherwise default to 'availability'.
  const [localCauseId, setLocalCauseId] = useState('availability')
  const [improvementPct, setImprovementPct] = useState(50)

  // When the shared selectedCauseId changes and matches a simulatable cause,
  // pre-select it so the simulator is ready for the user.
  useEffect(() => {
    if (!simDataQuery.data || !selectedCauseId) return
    const match = simDataQuery.data.causes.find((c) => c.id === selectedCauseId)
    if (match) setLocalCauseId(selectedCauseId)
  }, [selectedCauseId, simDataQuery.data])

  const result = simulateMutation.data

  // Sensitivity chart — computed before early returns
  const chartOption = useMemo(() => {
    if (!simDataQuery.data) return {}

    const { sensitivityCurve } = simDataQuery.data
    const curve = sensitivityCurve[localCauseId] || []

    return {
      grid: { top: 40, right: 60, bottom: 60, left: 80 },
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#2A292C',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#F4F4F4', fontSize: 12 },
        formatter: (params) => {
          const p = params[0]
          return `<strong style="color:#F4F4F4">${p.value[0]}% improvement</strong><br/>` +
            `<span style="color:#6EE7B7">Revenue: $${(p.value[1] / 1000).toFixed(0)}K</span>`
        },
      },
      xAxis: {
        type: 'value',
        name: 'Improvement %',
        nameLocation: 'middle',
        nameGap: 35,
        min: 0,
        max: 100,
        nameTextStyle: { color: '#6B7280', fontSize: 12 },
        axisLabel: { color: '#9CA3AF', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'value',
        name: 'Recovered Revenue ($)',
        nameTextStyle: { color: '#6B7280', fontSize: 12 },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          formatter: (val) => `$${(val / 1000).toFixed(0)}K`,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: 'Sensitivity',
          type: 'line',
          smooth: true,
          data: curve.map((pt) => [pt.improvementPct, pt.recoveredRevenue]),
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 3, color: '#10B981' },
          areaStyle: { color: 'rgba(16,185,129,0.08)' },
          markPoint: {
            data: [
              {
                coord: [improvementPct, result?.recoveredRevenue || 0],
                value: `${improvementPct}%`,
                itemStyle: { color: '#615FFF' },
              },
            ],
            label: { show: true, fontSize: 11, color: '#F4F4F4' },
          },
        },
      ],
    }
  }, [localCauseId, improvementPct, result, simDataQuery.data])

  // ── Early returns after all hooks ─────────────────────────
  if (simDataQuery.isLoading) {
    return <LoadingState message="Loading simulator…" />
  }

  if (simDataQuery.isError) {
    return <ErrorState message="Failed to load simulation data." onRetry={() => simDataQuery.refetch()} />
  }

  const { causes } = simDataQuery.data
  const activeCause = causes.find((c) => c.id === localCauseId)

  const handleSimulate = () => {
    simulateMutation.mutate({ causeId: localCauseId, improvementPct })
  }

  // Is the active cause pre-selected from the impact tree / waterfall?
  const isContextPreselected = selectedCauseId && selectedCauseId === localCauseId

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recovery Simulator"
        subtitle="Model the estimated financial impact of fixing controllable causes."
        badge="Simulation Tool"
        badgeVariant="success"
        actions={
          <Link
            to="/impact-tree"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'rgba(97,95,255,0.1)',
              border: '1px solid rgba(97,95,255,0.25)',
              color: '#818CF8',
            }}
          >
            <GitBranch className="w-3.5 h-3.5" />
            View Impact Tree
          </Link>
        }
      />

      {/* Context pre-selection notice */}
      {isContextPreselected && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{
            background: 'rgba(97,95,255,0.08)',
            border: '1px solid rgba(97,95,255,0.2)',
            color: '#818CF8',
          }}
        >
          <GitBranch className="w-3.5 h-3.5 shrink-0" />
          Pre-selected from Impact Tree / Waterfall:&nbsp;
          <strong style={{ color: '#A5B4FC' }}>{activeCause?.label}</strong>
        </div>
      )}

      {/* Controls */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Select Cause to Simulate
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {causes.map((c) => (
              <button
                key={c.id}
                onClick={() => setLocalCauseId(c.id)}
                className={cn(
                  'px-4 py-3 rounded-lg border-2 text-left transition-all',
                  localCauseId === c.id
                    ? 'border-primary bg-accent text-foreground'
                    : 'border-border bg-background hover:border-muted-foreground/30',
                )}
                aria-pressed={localCauseId === c.id}
              >
                <p className="font-semibold text-sm">{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current loss: {c.currentLossGwh.toFixed(1)} GWh
                </p>
                <p className="text-xs text-muted-foreground">
                  Max recoverable: {c.maxRecoverableGwh.toFixed(1)} GWh
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-foreground">
              Improvement Level: <span className="text-primary">{improvementPct}%</span>
            </label>
            <span className="text-xs text-muted-foreground">
              0% (no change) → 100% (fully eliminated)
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={improvementPct}
            onChange={(e) => setImprovementPct(+e.target.value)}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            aria-label={`Improvement level: ${improvementPct}%`}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        <button
          onClick={handleSimulate}
          disabled={simulateMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          aria-label="Run recovery simulation"
        >
          {simulateMutation.isPending ? 'Simulating…' : 'Run Simulation'}
        </button>
      </section>

      {/* Results */}
      {result && (
        <section className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-foreground">Simulation Results</h3>
            <span className="ml-auto px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              SIMULATED / ESTIMATED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Current Loss</p>
              <p className="text-2xl font-bold text-foreground">{result.currentLossGwh.toFixed(1)} GWh</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Improvement Applied</p>
              <p className="text-2xl font-bold text-foreground">{result.improvementPct}%</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-green-700 mb-1">Est. Recovered Generation</p>
              <p className="text-2xl font-bold text-green-700">{result.recoveredGwh.toFixed(2)} GWh</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-green-700 mb-1">Est. Recovered Revenue</p>
              <p className="text-2xl font-bold text-green-700">
                ${(result.recoveredRevenue / 1000).toFixed(0)}K
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-3 border-t">
            These are simulated estimates based on the recovery model. Actual recovery depends on operational
            execution and external conditions. Results should not be treated as guaranteed outcomes.
          </p>
        </section>
      )}

      {/* Sensitivity chart */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          Sensitivity Analysis: {activeCause?.label}
        </h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <ReactECharts option={chartOption} style={{ height: '360px' }} />
          <p className="text-xs text-muted-foreground text-center mt-3">
            Estimated revenue recovery potential across improvement levels (0–100%).
            These are model-based estimates, not guaranteed outcomes.
          </p>
        </div>
      </section>
    </div>
  )
}
