import { Link } from 'react-router-dom'
import { X, FileSearch, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThreeTruths } from '@/components/ui/ThreeTruths'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { cn } from '@/lib/utils'

/**
 * Detail panel that appears when a cause is selected from the attribution waterfall.
 * @param {{ cause: any | null, onClose: () => void }} props
 */
export function CauseDetailPanel({ cause, onClose }) {
  if (!cause) return null

  const { classification, confidence, recurrence, financialImpact, potentialRecovery, evidenceIds } = cause

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Selected Cause</p>
          <h3 className="text-xl font-bold text-foreground">{cause.cause}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Impact</p>
          <p className="text-2xl font-bold text-foreground">{cause.value.toFixed(1)} GWh</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Contribution</p>
          <p className="text-2xl font-bold text-foreground">{cause.contributionPct.toFixed(1)}%</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Classification</p>
        <ThreeTruths
          explainable={classification.explainable}
          controllable={classification.controllable}
          recoverable={classification.recoverable}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Confidence</p>
          <ConfidenceBadge value={confidence} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Recurrence</p>
          <p className="font-semibold text-foreground">{recurrence}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Financial Impact</p>
          <p className="font-semibold text-foreground">${(financialImpact / 1000).toFixed(0)}K</p>
        </div>
        {potentialRecovery && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Potential Recovery</p>
            <p className="font-semibold text-green-600">${(potentialRecovery / 1000).toFixed(0)}K</p>
          </div>
        )}
      </div>

      {evidenceIds && evidenceIds.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Evidence</p>
          <p className="text-sm font-medium text-foreground">
            {evidenceIds.length} item{evidenceIds.length > 1 ? 's' : ''}: {evidenceIds.join(', ')}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link to="/evidence" className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <FileSearch className="w-3.5 h-3.5" />
            View Evidence
          </Button>
        </Link>
        {classification.recoverable && (
          <Link to="/simulator" className="flex-1">
            <Button size="sm" className="w-full gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              Simulate Recovery
            </Button>
          </Link>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed pt-2 border-t">
        Model-attributed contribution. Not a proven causal claim. Based on {confidence}% confidence attribution model.
      </p>
    </div>
  )
}
