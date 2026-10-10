import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { ThreeTruths } from '@/components/ui/ThreeTruths'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { useOperations } from '@/hooks/useTrace'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusStyles = {
  Critical: 'bg-red-50 border-red-200 text-red-700',
  Warning:  'bg-amber-50 border-amber-200 text-amber-700',
  Info:     'bg-blue-50 border-blue-200 text-blue-700',
}

export function OperationsPage() {
  const operationsQuery = useOperations()
  const { selectedCauseId, selectCause } = useImpactTree()

  if (operationsQuery.isLoading) {
    return <LoadingState message="Loading operations data…" />
  }

  if (operationsQuery.isError) {
    return <ErrorState message="Failed to load operations data." />
  }

  const { summary, causes, events } = operationsQuery.data

  const activeCauseLabel = selectedCauseId
    ? selectedCauseId.replace('_', ' ').charAt(0).toUpperCase() + selectedCauseId.replace('_', ' ').slice(1)
    : null

  // If a cause is selected, filter or prioritize events
  const filteredEvents = selectedCauseId
    ? events.filter(
        (evt) =>
          evt.cause?.toLowerCase().includes(selectedCauseId.toLowerCase()) ||
          evt.id?.toLowerCase().includes(selectedCauseId.toLowerCase()),
      )
    : events

  const displayEvents = filteredEvents.length > 0 ? filteredEvents : events

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations"
        subtitle="Operational causes, equipment events, and controllable loss opportunities."
        badge="Operations Analysis"
        badgeVariant="warning"
      />

      {/* Cross-page selection filter banner */}
      {selectedCauseId && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>
              Synchronized with Impact Tree: <strong>{activeCauseLabel}</strong>
            </span>
          </div>
          <button
            onClick={() => selectCause(null)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Clear filter <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Total Operational Loss"
            value={summary.totalOperationalLossGwh.toFixed(1)}
            unit="GWh"
          />
          <MetricCard
            label="Controllable Loss"
            value={summary.controllableLossGwh.toFixed(1)}
            unit="GWh"
            highlight
          />
          <MetricCard
            label="Recoverable Loss"
            value={summary.recoverableLossGwh.toFixed(1)}
            unit="GWh"
            trend="up"
            trendPositive
          />
        </div>
      </section>

      {/* Operational causes */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Operational Causes</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {causes.map((cause) => {
            const isSelected = selectedCauseId && (
              cause.id === selectedCauseId.toLowerCase() ||
              cause.cause.toLowerCase().includes(selectedCauseId.toLowerCase())
            )

            return (
              <div
                key={cause.id}
                onClick={() => selectCause(isSelected ? null : cause.id)}
                className={cn(
                  'rounded-xl border bg-card p-5 space-y-3 cursor-pointer transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{cause.cause}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{cause.category}</p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-xs font-semibold',
                      statusStyles[cause.status] || statusStyles.Info,
                    )}
                  >
                    {cause.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Loss</p>
                    <p className="font-bold text-foreground">{cause.lossGwh.toFixed(1)} GWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Contribution</p>
                    <p className="font-bold text-foreground">{cause.contributionPct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Frequency</p>
                    <p className="font-medium">{cause.frequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                    <ConfidenceBadge value={cause.confidence} showLabel={false} />
                  </div>
                </div>

                <ThreeTruths
                  explainable
                  controllable={cause.controllability !== 'Low'}
                  recoverable={cause.recoverability !== 'Low'}
                  size="sm"
                />

                {cause.assets && cause.assets.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Assets</p>
                    <p className="text-xs font-mono">{cause.assets.join(', ')}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Recent events */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">
            {selectedCauseId && filteredEvents.length > 0
              ? `Events related to ${activeCauseLabel} (${displayEvents.length})`
              : `Recent Events (${events.length})`}
          </h2>
          {selectedCauseId && (
            <button
              onClick={() => selectCause(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset selection
            </button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Event ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Asset</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Duration</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Loss</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{evt.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{evt.date}</td>
                    <td className="px-4 py-3 font-medium">{evt.asset}</td>
                    <td className="px-4 py-3">{evt.type}</td>
                    <td className="px-4 py-3 font-medium">{evt.duration}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{evt.lossGwh.toFixed(1)} GWh</td>
                    <td className="px-4 py-3">{evt.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
