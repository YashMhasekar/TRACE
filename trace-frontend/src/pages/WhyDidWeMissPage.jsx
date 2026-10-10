import { useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { AttributionWaterfall } from '@/components/attribution/AttributionWaterfall'
import { CauseDetailPanel } from '@/components/attribution/CauseDetailPanel'
import { useOverview, useAttribution } from '@/hooks/useTrace'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { CheckCircle2, GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'

export function WhyDidWeMissPage() {
  const overviewQuery = useOverview()
  const attributionQuery = useAttribution()

  // Shared cross-app selection state
  const { selectedCauseId, selectCause } = useImpactTree()

  if (overviewQuery.isLoading || attributionQuery.isLoading) {
    return <LoadingState message="Loading attribution analysis…" />
  }

  if (overviewQuery.isError || attributionQuery.isError) {
    return <ErrorState message="Failed to load attribution data." />
  }

  const { plant, period, performance } = overviewQuery.data
  const { waterfall, reconciliation } = attributionQuery.data

  // Resolve the currently selected waterfall item from shared state
  const selectedCause = waterfall.find((w) => w.id === selectedCauseId) ?? null

  // Handler: waterfall bar clicked → update shared selectedCauseId
  const handleBarClick = (item) => {
    // item.id from attribution.json matches node id in impact-tree.json
    selectCause(item.id === selectedCauseId ? null : item.id)
  }

  const handleClose = () => selectCause(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Why Did We Miss?"
        subtitle={`${plant} · ${period}`}
        badge="Performance Gap Analysis"
        badgeVariant="critical"
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

      {/* Summary metrics */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="Expected" value={performance.expectedGwh.toFixed(1)} unit="GWh" />
          <MetricCard label="Actual" value={performance.actualGwh.toFixed(1)} unit="GWh" />
          <MetricCard
            label="Gap"
            value={performance.varianceGwh.toFixed(1)}
            unit="GWh"
            highlight
          />
          <MetricCard
            label="Variance"
            value={performance.variancePct.toFixed(2)}
            unit="%"
            trend="down"
            trendPositive={false}
          />
          <MetricCard
            label="Revenue Gap"
            value={`$${(performance.revenueGap / 1e6).toFixed(2)}M`}
            trend="down"
            trendPositive={false}
          />
        </div>
      </section>

      {/* Attribution waterfall */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Attribution Waterfall</h2>
            <p className="text-sm text-muted-foreground">
              Click a bar to view detailed cause analysis
              {selectedCauseId && (
                <span className="ml-2 font-medium text-primary">
                  · {waterfall.find((w) => w.id === selectedCauseId)?.label ?? selectedCauseId} selected
                </span>
              )}
            </p>
          </div>
          {reconciliation.status === 'PASS' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Reconciliation: PASS</span>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <AttributionWaterfall
            data={waterfall}
            selectedId={selectedCauseId}
            onBarClick={handleBarClick}
          />
          <p className="text-xs text-muted-foreground text-center mt-4">
            Expected {reconciliation.expected.toFixed(1)} GWh − Losses {reconciliation.totalLoss.toFixed(1)} GWh
            = Actual {reconciliation.actual.toFixed(1)} GWh
          </p>
        </div>
      </section>

      {/* Cause detail panel */}
      {selectedCause && (
        <section>
          <CauseDetailPanel cause={selectedCause} onClose={handleClose} />
        </section>
      )}
    </div>
  )
}
