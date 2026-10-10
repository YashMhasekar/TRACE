import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { ImpactTree } from '@/components/impact-tree/ImpactTree'
import { ImpactTreeDetailPanel } from '@/components/impact-tree/ImpactTreeDetailPanel'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { useImpactTree as useImpactTreeData } from '@/hooks/useTrace'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Reconciliation status banner — shown at page level.
 * Warns if attributed losses do not match the total gap.
 */
function ReconciliationBanner({ metadata }) {
  if (!metadata) return null

  const { expectedGwh, actualGwh, totalLossGwh } = metadata
  const computedGap = parseFloat((expectedGwh - actualGwh).toFixed(2))
  const reconciles = Math.abs(computedGap - totalLossGwh) < 0.1

  if (reconciles) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
        style={{
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          color: '#10B981',
        }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Reconciliation PASS — {expectedGwh.toFixed(1)} − {totalLossGwh.toFixed(1)} = {actualGwh.toFixed(1)} GWh
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.2)',
        color: '#F59E0B',
      }}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      Attribution does not fully reconcile with the observed performance gap.
    </div>
  )
}

/**
 * Summary stat strip shown above the graph.
 */
function StatStrip({ metadata, nodeCount }) {
  if (!metadata) return null

  const { expectedGwh, actualGwh, totalLossGwh, period, plantName } = metadata
  const variancePct = ((totalLossGwh / expectedGwh) * 100).toFixed(1)

  const stats = [
    { label: 'Plant',    value: plantName,                  mono: false },
    { label: 'Period',   value: period,                     mono: true  },
    { label: 'Expected', value: `${expectedGwh.toFixed(1)} GWh`, mono: false },
    { label: 'Actual',   value: `${actualGwh.toFixed(1)} GWh`,   mono: false },
    { label: 'Gap',      value: `−${totalLossGwh.toFixed(1)} GWh`, mono: false, highlight: true },
    { label: 'Variance', value: `−${variancePct}%`,         mono: false, highlight: true },
    { label: 'Nodes',    value: `${nodeCount}`,              mono: true  },
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-xl text-xs"
      style={{
        background: 'rgba(42,41,44,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {stats.map(({ label, value, mono, highlight }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span style={{ color: '#6B7280' }}>{label}</span>
          <span
            className={cn(mono && 'font-mono')}
            style={{
              color: highlight ? '#EF4444' : '#F4F4F4',
              fontWeight: highlight ? 700 : 600,
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export function ImpactTreePage() {
  const treeQuery = useImpactTreeData()
  const { selectedCauseId } = useImpactTree()

  // Detail panel collapse on mobile/tablet
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const handleNodeSelect = useCallback((node) => {
    // On mobile, auto-expand the panel when a node is selected
    if (node) setPanelCollapsed(false)
  }, [])

  if (treeQuery.isLoading) {
    return <LoadingState message="Loading impact tree…" />
  }

  if (treeQuery.isError) {
    return (
      <ErrorState
        message="Failed to load impact tree data."
        onRetry={() => treeQuery.refetch()}
      />
    )
  }

  if (!treeQuery.data || !treeQuery.data.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8" style={{ color: '#F59E0B' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>
          No attribution data available for this period.
        </p>
      </div>
    )
  }

  const { nodes, edges, metadata } = treeQuery.data
  const causeCount = nodes.filter((n) => n.type === 'cause').length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Impact Tree"
        subtitle={`${metadata?.plantName ?? 'Solar Plant Alpha'} · ${metadata?.period ?? 'May 2026'}`}
        badge="Performance Attribution"
        badgeVariant="critical"
        actions={
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(97,95,255,0.1)',
                border: '1px solid rgba(97,95,255,0.25)',
                color: '#818CF8',
              }}
            >
              <GitBranch className="w-3.5 h-3.5" />
              {causeCount} causes · {nodes.length} nodes
            </div>
          </div>
        }
      />

      {/* Reconciliation banner */}
      <ReconciliationBanner metadata={metadata} />

      {/* Stat strip */}
      <StatStrip metadata={metadata} nodeCount={nodes.length} />

      {/* Graph + panel layout */}
      <div className="flex gap-4 items-start">

        {/* Graph — takes remaining width */}
        <div className="flex-1 min-w-0">
          <ImpactTree
            nodes={nodes}
            edges={edges}
            onNodeSelect={handleNodeSelect}
            className="w-full"
          />

          {/* Mobile: show selected cause label below graph */}
          {selectedCauseId && (
            <div
              className="mt-2 px-3 py-2 rounded-lg flex items-center justify-between lg:hidden"
              style={{
                background: 'rgba(97,95,255,0.1)',
                border: '1px solid rgba(97,95,255,0.25)',
              }}
            >
              <span className="text-xs font-medium" style={{ color: '#818CF8' }}>
                {nodes.find((n) => n.id === selectedCauseId)?.label ?? selectedCauseId} selected
              </span>
              <button
                onClick={() => setPanelCollapsed((v) => !v)}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: '#615FFF' }}
              >
                {panelCollapsed ? 'Show detail' : 'Hide detail'}
                {panelCollapsed
                  ? <ChevronRight className="w-3.5 h-3.5" />
                  : <ChevronLeft className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          )}
        </div>

        {/* Detail panel — fixed width sidebar */}
        <div
          className={cn(
            'shrink-0 transition-all duration-300',
            // Desktop: always visible at fixed width
            'hidden lg:block',
            // Tablet/mobile: controlled by panelCollapsed
            selectedCauseId ? 'lg:block' : 'lg:block',
          )}
          style={{ width: 300 }}
        >
          <div style={{ height: 580 }}>
            <ImpactTreeDetailPanel rawNodes={nodes} />
          </div>
        </div>

        {/* Mobile detail panel — below graph, collapsible */}
        {!panelCollapsed && selectedCauseId && (
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl overflow-hidden"
            style={{
              background: '#2A292C',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '60vh',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ height: 'calc(60vh - 20px)' }}>
              <ImpactTreeDetailPanel rawNodes={nodes} />
            </div>
          </div>
        )}
      </div>

      {/* Attribution methodology note */}
      <div
        className="flex gap-2.5 px-4 py-3 rounded-xl text-xs leading-relaxed"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          color: '#4B5563',
        }}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#4B5563' }} />
        <span>
          All values represent <strong style={{ color: '#6B7280' }}>model-attributed contributions</strong> based
          on the deterministic attribution engine. Node relationships represent correlated contributing factors,
          not proven causality, unless explicitly stated. Evidence-supported attributions are marked with evidence IDs.
          Simulation values are estimated, not guaranteed.
        </span>
      </div>
    </div>
  )
}
