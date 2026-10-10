/**
 * ModelRunnerLivePage.jsx
 * Phase 2: Live pipeline view.
 *
 * Features:
 *  - Polls /status + /events every 2 s while running
 *  - TIMEOUT: if running > TIMEOUT_SECONDS with no progress, marks failed
 *  - STOP button: calls cancelAnalysis(), shows stopped state
 *  - RE-EVALUATE button: calls rerunAnalysis(), navigates to new live view
 *  - Navigates to /results on completion
 *  - Navigates to failure UI on error
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Loader2, AlertCircle, X, RefreshCw, Zap, History,
  Square, RotateCcw, Clock, AlertTriangle,
} from 'lucide-react'
import { fetchStatus, fetchEvents, cancelAnalysis, rerunAnalysis } from '@/api/modelRunnerApi'
import { PipelineStage } from '@/components/model-runner/PipelineStage'
import { StageDetailPanel } from '@/components/model-runner/StageDetailPanel'
import { EventLog } from '@/components/model-runner/EventLog'
import { HistoryDrawer } from '@/components/model-runner/HistoryDrawer'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────
/** If a run stays "running" with no progress change for this many seconds → timeout */
const TIMEOUT_SECONDS = 120
/** Poll interval while running */
const POLL_INTERVAL_MS = 2000

const STAGE_ORDER = [
  'dataset_ingestion',
  'data_quality',
  'column_mapping',
  'normalization',
  'expected_generation',
  'variance',
  'attribution',
  'evidence',
  'recurrence',
  'recoverability',
  'recommendations',
]

// ── Elapsed timer hook ────────────────────────────────────────────────────
function useElapsed(startTs) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startTs) return
    const start = new Date(startTs).getTime()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startTs])
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return { formatted: `${mm}:${ss}`, seconds: elapsed }
}

// ── Stage status derivation ───────────────────────────────────────────────
function deriveStageStatuses(stages, currentStage, pipelineStatus) {
  const stageMap = {}
  for (const s of stages ?? []) {
    stageMap[s.stage_id] = { status: s.status, metrics: s.metrics, warnings: s.warnings }
  }
  const result = {}
  let currentFound = false
  for (const sid of STAGE_ORDER) {
    if (stageMap[sid]) {
      result[sid] = stageMap[sid]
    } else if (!currentFound && sid === currentStage) {
      result[sid] = { status: pipelineStatus === 'failed' ? 'failed' : 'running', metrics: {} }
      currentFound = true
    } else {
      result[sid] = { status: currentFound ? 'queued' : 'queued', metrics: {} }
    }
  }
  return result
}

// ── Failure / stopped detail panel ────────────────────────────────────────
function StatusPanel({ type, stages, errorMessage, elapsedSeconds, onRetry, onBack, onRerun, rerunning }) {
  const isTimeout = type === 'timeout'
  const isStopped = type === 'stopped'
  const isFailed = type === 'failed'

  const failedStage = stages?.find((s) => s.status === 'failed')

  const iconColor = isStopped ? 'text-amber-500' : 'text-red-500'
  const borderColor = isStopped ? 'border-amber-500/30' : 'border-red-500/30'
  const bgColor = isStopped ? 'bg-amber-500/6' : 'bg-red-500/6'
  const iconBg = isStopped ? 'bg-amber-500/15 border-amber-500/30' : 'bg-red-500/15 border-red-500/30'

  const title =
    isTimeout ? 'Analysis Timed Out' :
      isStopped ? 'Analysis Stopped' :
        'Analysis Failed'

  const subtitle =
    isTimeout ? `No progress after ${Math.round(elapsedSeconds / 60)} min — the backend may be unavailable.` :
      isStopped ? 'You stopped this analysis run.' :
        failedStage ? `Failed at stage: ${failedStage.stage_id?.replace(/_/g, ' ')}` :
          'An error occurred during analysis.'

  return (
    <div className={cn('rounded-xl border p-6 space-y-4', borderColor, bgColor)}>
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-full border flex items-center justify-center', iconBg)}>
          {isStopped
            ? <Square className={cn('w-4 h-4', iconColor)} />
            : isTimeout
              ? <Clock className={cn('w-5 h-5', iconColor)} />
              : <X className={cn('w-5 h-5', iconColor)} />
          }
        </div>
        <div>
          <p className="font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Error detail */}
      {isFailed && failedStage?.metrics?.error && (
        <div className="rounded-lg bg-muted/40 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Error detail</p>
          <p className="text-sm text-foreground">{failedStage.metrics.error}</p>
          {failedStage.metrics.detail && (
            <p className="text-xs text-muted-foreground font-mono mt-1">{failedStage.metrics.detail}</p>
          )}
        </div>
      )}

      {/* Error detail from message */}
      {errorMessage && !failedStage?.metrics?.error && (
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Detail</p>
          <p className="text-sm text-foreground font-mono">{errorMessage}</p>
        </div>
      )}

      {/* Checklist for failed/timeout */}
      {(isFailed || isTimeout) && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What you can do</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Verify all required columns are present in the CSV</li>
            <li>• Check timestamp format and data completeness</li>
            <li>• Ensure the reference period has ≥ 50 valid daytime rows</li>
            {isTimeout && <li>• The backend server may need to be restarted</li>}
            <li>• Try re-evaluating with the same dataset</li>
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Back to Upload
        </button>
        <button
          onClick={onRerun}
          disabled={rerunning}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ background: rerunning ? undefined : '#615FFF' }}
        >
          {rerunning
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RotateCcw className="w-4 h-4" />
          }
          Re-evaluate
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export function ModelRunnerLivePage() {
  const { analysisId } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedStage, setSelected] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Stop / re-run UI state
  const [stopping, setStopping] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [localStatus, setLocalStatus] = useState(null)   // 'stopped' | 'timeout' | null
  const [stopError, setStopError] = useState(null)

  const eventIndexRef = useRef(0)
  const pollingRef = useRef(null)
  const lastProgressRef = useRef(null)  // track last seen progress value
  const lastProgressTsRef = useRef(Date.now())  // timestamp when progress last changed

  const { formatted: elapsed, seconds: elapsedSeconds } = useElapsed(status?.created_at)

  // ── Stop polling ──────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // ── Handle stop button ────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (stopping) return
    setStopping(true)
    stopPolling()
    try {
      await cancelAnalysis(analysisId)
      setLocalStatus('stopped')
    } catch (err) {
      setStopError(err.message ?? 'Stop request failed')
      setLocalStatus('stopped')   // treat as stopped even on error
    } finally {
      setStopping(false)
    }
  }, [analysisId, stopping, stopPolling])

  // ── Handle re-evaluate ────────────────────────────────────────────────
  const handleRerun = useCallback(async () => {
    if (rerunning) return
    setRerunning(true)
    try {
      const result = await rerunAnalysis(analysisId)
      navigate(`/model-runner/live/${result.analysis_id}`, { replace: true })
    } catch (_err) {
      // If rerun endpoint not available, go back to upload page
      navigate('/model-runner')
    } finally {
      setRerunning(false)
    }
  }, [analysisId, rerunning, navigate])

  // ── Polling loop ──────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    // Don't poll if already locally stopped or timed out
    if (localStatus) return

    try {
      const [st, evtData] = await Promise.all([
        fetchStatus(analysisId),
        fetchEvents(analysisId, eventIndexRef.current),
      ])

      setStatus(st)
      setFetchError(null)

      if (evtData.events?.length) {
        eventIndexRef.current = evtData.total
        setEvents((prev) => [...prev, ...evtData.events])
      }

      // ── Timeout detection ──────────────────────────────────────────
      const currentProgress = st.progress ?? 0
      if (currentProgress !== lastProgressRef.current) {
        lastProgressRef.current = currentProgress
        lastProgressTsRef.current = Date.now()
      } else if (
        st.status === 'running' &&
        Date.now() - lastProgressTsRef.current > TIMEOUT_SECONDS * 1000
      ) {
        stopPolling()
        setLocalStatus('timeout')
        return
      }

      // ── Navigate on completion ─────────────────────────────────────
      if (st.status === 'completed') {
        stopPolling()
        navigate(`/model-runner/results/${analysisId}`, { replace: true })
        return
      }

      // ── Auto-stop polling on backend failure ───────────────────────
      if (st.status === 'failed') {
        stopPolling()
        return
      }

      // Keep selected stage synced
      if (st.status === 'running') {
        setSelected(st.current_stage)
      }
    } catch (err) {
      setFetchError(err.message)
    }
  }, [analysisId, navigate, stopPolling, localStatus])

  useEffect(() => {
    // Initialise progress tracking
    lastProgressRef.current = null
    lastProgressTsRef.current = Date.now()

    poll()
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [poll, stopPolling])

  // ── Derived state ─────────────────────────────────────────────────────
  const stages = status?.stages ?? []
  const stageMap = deriveStageStatuses(stages, status?.current_stage, status?.status)
  const progress = status?.progress ?? 0
  const completed = STAGE_ORDER.filter((id) =>
    ['completed', 'warning'].includes(stageMap[id]?.status),
  ).length

  const isBackendFailed = status?.status === 'failed'
  const isStopped = localStatus === 'stopped'
  const isTimedOut = localStatus === 'timeout'
  const isTerminal = isStopped || isTimedOut || isBackendFailed
  const isRunning = !isTerminal && status?.status === 'running'

  const config = status?.config ?? {}
  const dataset = status?.dataset ?? {}
  const activeStage = selectedStage ?? status?.current_stage ?? STAGE_ORDER[0]

  // ── Full-page error (can't even load status) ──────────────────────────
  if (fetchError && !status) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <button onClick={() => navigate('/model-runner')} className="text-xs text-primary hover:underline">
          Back to Model Runner
        </button>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Connecting to analysis…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(97,95,255,0.15)' }}>
            <Zap className="w-4 h-4" style={{ color: '#615FFF' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {config.plant_name || dataset.filename || 'Analysis Running'}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">{analysisId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Elapsed time */}
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">Elapsed</p>
            <p className="text-sm font-mono font-semibold text-foreground">{elapsed}</p>
          </div>

          {/* Stage counter */}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{completed}/{STAGE_ORDER.length} stages</p>
            <p className="text-sm font-bold text-foreground">{progress}%</p>
          </div>

          {/* ── STOP button — only while running ──────────────────── */}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={stopping}
              title="Stop this analysis"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                borderColor: 'rgba(239,68,68,0.40)',
                color: '#EF4444',
                background: 'rgba(239,68,68,0.08)',
              }}
            >
              {stopping
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Square className="w-3.5 h-3.5" />
              }
              {stopping ? 'Stopping…' : 'Stop'}
            </button>
          )}

          {/* ── RE-EVALUATE — when terminal ───────────────────────── */}
          {isTerminal && (
            <button
              onClick={handleRerun}
              disabled={rerunning}
              title="Re-evaluate with same dataset"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                background: '#615FFF',
                color: '#fff',
              }}
            >
              {rerunning
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5" />
              }
              {rerunning ? 'Starting…' : 'Re-evaluate'}
            </button>
          )}

          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Analysis history"
          >
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${isTerminal ? progress : progress}%`,
            background: isStopped ? '#F59E0B' :
              isTimedOut ? '#F59E0B' :
                isBackendFailed ? '#EF4444' :
                  '#615FFF',
          }}
        />
      </div>

      {/* ── Timeout warning banner (while still within grace period) ─── */}
      {!isTerminal && elapsedSeconds > TIMEOUT_SECONDS * 0.75 && elapsedSeconds < TIMEOUT_SECONDS && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] border text-xs"
          style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Analysis has been running for {Math.round(elapsedSeconds / 60)} min.
            It will time out in ~{Math.round((TIMEOUT_SECONDS - elapsedSeconds) / 60)} min if no progress is detected.
          </span>
        </div>
      )}

      {/* ── Metadata chips ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'Dataset', value: dataset.filename },
          { label: 'Rows', value: dataset.rows?.toLocaleString() },
          { label: 'Model', value: 'Gradient Boosting' },
          { label: 'Ref', value: config.reference_period === 'auto' ? 'Auto' : config.reference_period },
        ].filter((c) => c.value).map(({ label, value }) => (
          <span key={label}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] text-muted-foreground"
            style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.04)' }}
          >
            <span className="font-medium text-foreground/70">{label}:</span> {value}
          </span>
        ))}
        {/* Status pill */}
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ml-auto"
          style={{
            borderColor: isRunning ? 'rgba(97,95,255,0.35)' :
              isStopped ? 'rgba(245,158,11,0.35)' :
                isTimedOut ? 'rgba(245,158,11,0.35)' :
                  isBackendFailed ? 'rgba(239,68,68,0.35)' :
                    'rgba(16,185,129,0.35)',
            color: isRunning ? '#615FFF' :
              isStopped ? '#F59E0B' :
                isTimedOut ? '#F59E0B' :
                  isBackendFailed ? '#EF4444' :
                    '#10B981',
            background: isRunning ? 'rgba(97,95,255,0.08)' :
              isStopped ? 'rgba(245,158,11,0.08)' :
                isTimedOut ? 'rgba(245,158,11,0.08)' :
                  isBackendFailed ? 'rgba(239,68,68,0.08)' :
                    'rgba(16,185,129,0.08)',
          }}
        >
          {isRunning && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {isStopped ? 'STOPPED' :
            isTimedOut ? 'TIMED OUT' :
              isBackendFailed ? 'FAILED' :
                isRunning ? 'RUNNING' :
                  (status?.status ?? 'UNKNOWN').toUpperCase()}
        </span>
      </div>

      {/* ── Main body ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 min-h-0">
        {/* Pipeline stage list */}
        <div className="w-52 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
            Pipeline
          </p>
          {STAGE_ORDER.map((sid) => {
            const sd = stageMap[sid] ?? { status: 'queued', metrics: {} }
            return (
              <PipelineStage
                key={sid}
                stageId={sid}
                status={sd.status}
                metrics={sd.metrics}
                isActive={sid === activeStage}
                onClick={() => setSelected(sid)}
              />
            )
          })}
        </div>

        {/* Stage detail / terminal panel */}
        <div className="flex-1 min-w-0 rounded-[10px] border border-border bg-card overflow-hidden">
          {isTerminal ? (
            <div className="p-5">
              <StatusPanel
                type={isStopped ? 'stopped' : isTimedOut ? 'timeout' : 'failed'}
                stages={stages}
                errorMessage={stopError ?? fetchError}
                elapsedSeconds={elapsedSeconds}
                onBack={() => navigate('/model-runner')}
                onRetry={() => navigate('/model-runner')}
                onRerun={handleRerun}
                rerunning={rerunning}
              />
            </div>
          ) : (
            <StageDetailPanel
              currentStageId={activeStage}
              stages={stages}
              status={status?.status}
            />
          )}
        </div>
      </div>

      {/* Event log */}
      <EventLog events={events} />

      {/* History drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(run) => {
          if (run.status === 'completed') navigate(`/model-runner/results/${run.analysis_id}`)
          else if (run.status === 'running') navigate(`/model-runner/live/${run.analysis_id}`)
          setHistoryOpen(false)
        }}
      />
    </div>
  )
}
