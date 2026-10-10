import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { EvidenceGraph } from '@/components/evidence/EvidenceGraph'
import { useEvidence } from '@/hooks/useTrace'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EvidencePage() {
  const evidenceQuery = useEvidence()
  const { selectedCauseId, selectCause } = useImpactTree()
  const [selectedId, setSelectedId] = useState(null)

  // ALL hooks must be called before any early returns
  const items = evidenceQuery.data?.items ?? []

  const filteredItems = useMemo(() => {
    if (!selectedCauseId) return items
    const match = items.filter(
      (e) =>
        e.linkedCause?.toLowerCase() === selectedCauseId.toLowerCase() ||
        e.tags?.some((t) => t.toLowerCase().includes(selectedCauseId.toLowerCase())),
    )
    return match.length > 0 ? match : items
  }, [items, selectedCauseId])

  if (evidenceQuery.isLoading) {
    return <LoadingState message="Loading evidence…" />
  }

  if (evidenceQuery.isError) {
    return <ErrorState message="Failed to load evidence data." />
  }

  // Format cause name for display
  const activeCause = selectedCauseId
    ? selectedCauseId.charAt(0).toUpperCase() + selectedCauseId.slice(1)
    : 'Availability'

  const selected = items.find((e) => e.id === selectedId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        subtitle="Validate each attribution with linked evidence from meters, events, models, and inspections."
        badge="Evidence Explorer"
        badgeVariant="info"
      />

      {/* Cross-page selection filter banner */}
      {selectedCauseId && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-primary/30 bg-primary/10 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>
              Synchronized with Impact Tree: <strong>{activeCause}</strong>
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

      {/* Evidence graph */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          Evidence Chain: {activeCause}
        </h2>
        <EvidenceGraph causeId={selectedCauseId || 'availability'} />
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Interactive evidence chain showing how {activeCause} attribution is supported by meter readings, events, and calculations.
        </p>
      </section>

      {/* Evidence table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">
            {selectedCauseId
              ? `Evidence Items for ${activeCause} (${filteredItems.length})`
              : `All Evidence Items (${items.length})`}
          </h2>
          {selectedCauseId && filteredItems.length !== items.length && (
            <button
              onClick={() => selectCause(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Show all ({items.length})
            </button>
          )}
        </div>
        <div className="rounded-[10px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Linked Cause</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'cursor-pointer hover:bg-muted/40 transition-colors',
                      selectedId === item.id && 'bg-accent',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{item.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.type}</td>
                    <td className="px-4 py-3 max-w-md">{item.description}</td>
                    <td className="px-4 py-3 font-medium">{item.linkedCause}</td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={item.confidence} showLabel={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detail panel */}
      {selected && (
        <section className="rounded-[10px] border border-border bg-card-elevated p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 tracking-wider">Selected Evidence</p>
            <h3 className="text-xl font-bold text-foreground">{selected.id}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <p className="font-medium">{selected.type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Source</p>
              <p className="font-medium">{selected.source}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Asset</p>
              <p className="font-medium">{selected.asset}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date</p>
              <p className="font-medium">{selected.date}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm leading-relaxed">{selected.description}</p>
          </div>
          {selected.calculation && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Calculation</p>
              <p className="text-sm font-mono bg-muted px-3 py-2 rounded-lg">{selected.calculation}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Confidence</p>
            <ConfidenceBadge value={selected.confidence} />
          </div>
        </section>
      )}
    </div>
  )
}
