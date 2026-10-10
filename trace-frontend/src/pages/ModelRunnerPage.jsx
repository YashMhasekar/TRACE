/**
 * ModelRunnerPage.jsx
 * Phase 1: Upload → Dataset Preview → Quality → Config → Run
 *
 * State machine:
 *   idle        → drag-and-drop upload area
 *   uploading   → parsing preview via backend /upload
 *   preview     → DatasetCard + QualityPanel + config form
 *   submitting  → calling /analyze, then navigate to live view
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, HelpCircle, History, AlertCircle,
  Loader2, ChevronRight, Zap, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, RotateCcw, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadDataset, startAnalysis, fetchHistory } from '@/api/modelRunnerApi'
import { DatasetCard } from '@/components/model-runner/DatasetCard'
import { QualityPanel } from '@/components/model-runner/QualityPanel'
import { HistoryDrawer } from '@/components/model-runner/HistoryDrawer'

// ── Analysis ID color hash (for visual variety in the list) ───────────────
function idColor(id = '') {
  const colors = ['#615FFF', '#10B981', '#F59E0B', '#EF4444', '#7C86FF', '#34D399']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return colors[h % colors.length]
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function StatusBadge({ status }) {
  const cfg = {
    completed: { label: 'COMPLETED', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)' },
    failed: { label: 'FAILED', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.30)' },
    running: { label: 'RUNNING', color: '#615FFF', bg: 'rgba(97,95,255,0.12)', border: 'rgba(97,95,255,0.30)' },
    cancelled: { label: 'STOPPED', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)' },
  }[status] ?? { label: status?.toUpperCase() ?? 'UNKNOWN', color: '#B7B7B7', bg: 'rgba(183,183,183,0.12)', border: 'rgba(183,183,183,0.30)' }

  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

/**
 * Inline analysis history panel — always visible below the upload zone.
 * Shows up to 8 recent runs. Refreshes every time the component mounts
 * (so a freshly started run appears after navigation back).
 */
function AnalysisHistoryPanel({ onSelect }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchHistory(8)
      .then((d) => setRuns(d.runs ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-[10px] border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Analysis History</p>
          {runs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(97,95,255,0.12)', color: '#615FFF' }}>
              {runs.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Body */}
      <div className="divide-y divide-border/50">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#615FFF' }} />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <p className="text-xs">No analysis runs yet. Upload a dataset to get started.</p>
          </div>
        )}

        {!loading && runs.map((run) => {
          const color = idColor(run.analysis_id)
          const canOpen = run.status === 'completed' || run.status === 'running'
          return (
            <button
              key={run.analysis_id}
              onClick={() => canOpen && onSelect(run)}
              disabled={!canOpen}
              className={cn(
                'w-full text-left px-4 py-3 transition-colors group',
                canOpen ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default opacity-75',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Color dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  style={{ background: color }}
                />

                <div className="flex-1 min-w-0">
                  {/* Row 1: plant name + status */}
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {run.plant_name || run.filename || 'Unknown Plant'}
                    </p>
                    <StatusBadge status={run.status} />
                  </div>

                  {/* Row 2: analysis ID */}
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {run.analysis_id}
                  </p>

                  {/* Row 3: loss + date */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-semibold"
                      style={{ color: run.variance_kwh != null ? '#EF4444' : 'inherit' }}>
                      {run.variance_kwh != null
                        ? `${run.variance_kwh < 0 ? '' : '-'}${Math.abs(run.variance_kwh).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh loss`
                        : run.status === 'running' ? 'In progress…' : '—'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(run.created_at)}</span>
                  </div>

                  {/* Progress bar for running jobs */}
                  {run.status === 'running' && run.progress != null && (
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${run.progress}%`, background: '#615FFF' }}
                      />
                    </div>
                  )}
                </div>

                {/* Arrow for openable runs */}
                {canOpen && (
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Upload zone ────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer',
        'min-h-56 px-8 py-12 transition-all duration-200 select-none',
        dragging
          ? 'border-primary bg-primary/8 scale-[1.01]'
          : 'border-border/50 bg-card/60 hover:border-primary/40 hover:bg-card',
        disabled && 'opacity-50 pointer-events-none',
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      aria-label="Upload CSV file"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />

      {/* Icon */}
      <div className={cn(
        'w-16 h-16 rounded-2xl border flex items-center justify-center transition-colors',
        dragging ? 'bg-primary/20 border-primary/40' : 'bg-muted/60 border-border/40',
      )}>
        <Upload className={cn('w-7 h-7', dragging ? 'text-primary' : 'text-muted-foreground')} />
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-foreground">
          Drag & drop your plant dataset
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          or <span className="text-primary font-medium">click to browse</span>
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> CSV
        </span>
        <span>•</span>
        <span>Max 50 MB</span>
        <span>•</span>
        <span>15-min interval recommended</span>
      </div>

      {/* Schema hint */}
      <a
        href="/sample-schema.csv"
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-primary/70 hover:text-primary underline underline-offset-2"
      >
        View expected column schema
      </a>
    </div>
  )
}

// ── Config section ─────────────────────────────────────────────────────────
function ConfigSection({ config, onChange }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analysis Configuration</p>

      {/* Plant name */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Plant Name / ID
        </label>
        <input
          type="text"
          value={config.plantName}
          onChange={(e) => onChange({ ...config, plantName: e.target.value })}
          placeholder="e.g. Solar Plant Alpha"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Reference period */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Reference Period
        </label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Used for expected-generation model training. Not assumed to be a healthy baseline —
          selected after operational-quality filtering.
        </p>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="refPeriod"
              value="auto"
              checked={config.referencePeriod === 'auto'}
              onChange={() => onChange({ ...config, referencePeriod: 'auto' })}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">Automatic (first month, quality-filtered)</span>
          </label>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="refPeriod"
              value="manual"
              checked={config.referencePeriod !== 'auto'}
              onChange={() => onChange({ ...config, referencePeriod: config.manualRef || '' })}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">Manual:</span>
          </label>
          <input
            type="month"
            value={config.referencePeriod !== 'auto' ? config.referencePeriod : ''}
            onChange={(e) => onChange({ ...config, referencePeriod: e.target.value })}
            disabled={config.referencePeriod === 'auto'}
            className="px-2 py-1 rounded border border-border bg-background text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Tariff (optional) */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Tariff (USD/kWh) <span className="text-muted-foreground font-normal">— optional</span>
        </label>
        <p className="text-[11px] text-muted-foreground mb-2">
          If provided, TRACE will calculate commercial revenue impact. Leave blank to skip.
        </p>
        <input
          type="number"
          step="0.001"
          min="0"
          value={config.tariff ?? ''}
          onChange={(e) => onChange({ ...config, tariff: e.target.value ? Number(e.target.value) : null })}
          placeholder="e.g. 0.055"
          className="w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </div>
  )
}

// ── Ready summary ──────────────────────────────────────────────────────────
function ReadySummary({ preview, config }) {
  const items = [
    { label: 'Dataset', value: preview.filename },
    { label: 'Rows', value: preview.rows?.toLocaleString() },
    { label: 'Interval', value: preview.interval_minutes ? `${preview.interval_minutes} min` : 'Unknown' },
    { label: 'Reference period', value: config.referencePeriod === 'auto' ? 'Auto (quality-filtered)' : config.referencePeriod },
    { label: 'Model', value: 'Gradient Boosting Regressor' },
    { label: 'Tariff', value: config.tariff ? `$${config.tariff}/kWh` : 'Not provided' },
  ]
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Ready to analyze</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {items.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export function ModelRunnerPage() {
  const navigate = useNavigate()

  const [phase, setPhase] = useState('idle')   // idle | uploading | preview | submitting
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [runError, setRunError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  // Bump this to force the inline history panel to reload after a new run
  const [historyKey, setHistoryKey] = useState(0)

  const [config, setConfig] = useState({
    plantName: '',
    referencePeriod: 'auto',
    tariff: null,
    settlementFactor: 1.0,
  })

  // ── Handle file selection ──────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    setFile(f)
    setUploadError(null)
    setPhase('uploading')
    try {
      const data = await uploadDataset(f)
      setPreview(data)
      // Pre-fill plant name from filename
      if (!config.plantName) {
        const base = f.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' ')
        setConfig((c) => ({ ...c, plantName: base }))
      }
      setPhase('preview')
    } catch (err) {
      setUploadError(err.message ?? 'Failed to read dataset')
      setPhase('idle')
    }
  }, [config.plantName])

  // ── Start analysis ─────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!file || !preview?.can_run) return
    setRunError(null)
    setPhase('submitting')
    try {
      const result = await startAnalysis({
        file,
        plantName: config.plantName || preview.filename,
        referencePeriod: config.referencePeriod,
        tariff: config.tariff,
        settlementFactor: config.settlementFactor,
      })
      navigate(`/model-runner/live/${result.analysis_id}`)
    } catch (err) {
      setRunError(err.message ?? 'Failed to start analysis')
      setPhase('preview')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Model Runner</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload plant performance data and run the complete TRACE investigation pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Upload failed</p>
            <p className="text-xs mt-0.5 opacity-80">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Phase: idle */}
      {phase === 'idle' && (
        <DropZone onFile={handleFile} disabled={false} />
      )}

      {/* Phase: uploading */}
      {phase === 'uploading' && (
        <div className="flex flex-col items-center justify-center min-h-56 gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Parsing dataset…</p>
          <p className="text-xs text-muted-foreground">{file?.name}</p>
        </div>
      )}

      {/* Phase: preview */}
      {phase === 'preview' && preview && (
        <>
          <DatasetCard preview={preview} />
          <QualityPanel quality={preview.quality} totalRows={preview.rows} />
          <ConfigSection config={config} onChange={setConfig} />

          {preview.can_run && (
            <ReadySummary preview={preview} config={config} />
          )}

          {/* Missing required columns error */}
          {(preview.missing_required ?? []).length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">Cannot run analysis</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Missing required columns: {preview.missing_required.join(', ')}
                </p>
              </div>
            </div>
          )}

          {runError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-sm">{runError}</p>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase('idle'); setPreview(null); setFile(null) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Upload different file
            </button>
            <button
              onClick={handleRun}
              disabled={!preview.can_run || phase === 'submitting'}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all',
                preview.can_run
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              {phase === 'submitting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting pipeline…</>
              ) : (
                <><Zap className="w-4 h-4" /> Run TRACE Analysis <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </>
      )}

      {/* ── Inline Analysis History ─────────────────────────────────── */}
      <AnalysisHistoryPanel
        key={historyKey}
        onSelect={(run) => {
          if (run.status === 'completed') navigate(`/model-runner/results/${run.analysis_id}`)
          else if (run.status === 'running') navigate(`/model-runner/live/${run.analysis_id}`)
        }}
      />

      {/* Drawer (kept for mobile / results page trigger) */}
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
