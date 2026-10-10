/**
 * HistoryDrawer.jsx
 * Slide-in panel listing past analysis runs.
 * Shows status, plant name, date, loss kwh, link to reopen.
 */
import { useEffect, useState } from 'react'
import { fetchHistory } from '@/api/modelRunnerApi'
import { X, CheckCircle2, AlertTriangle, Clock, Loader2, History } from 'lucide-react'
import { cn } from '@/lib/utils'

function statusIcon(status) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
  if (status === 'failed')    return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
  if (status === 'running')   return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
}

function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

export function HistoryDrawer({ open, onClose, onSelect }) {
  const [runs, setRuns]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchHistory(20)
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Analysis History</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && runs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              No analysis runs yet. Upload a dataset to get started.
            </p>
          )}
          {!loading && runs.map((run) => (
            <button
              key={run.analysis_id}
              onClick={() => { onSelect(run); onClose() }}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/30 last:border-0 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(run.status)}
                  <p className="text-xs font-semibold text-foreground truncate">
                    {run.plant_name || run.filename || run.analysis_id}
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0',
                  run.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600' :
                  run.status === 'failed'    ? 'bg-red-500/15 text-red-500' :
                  'bg-muted text-muted-foreground',
                )}>
                  {run.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{run.analysis_id}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {run.variance_kwh != null && (
                  <span className="text-[11px] text-foreground font-medium">
                    {run.variance_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh loss
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(run.created_at)}</span>
              </div>
              {run.status === 'running' && (
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${run.progress}%` }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
