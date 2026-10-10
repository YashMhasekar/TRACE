import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  FileSearch,
  FlaskConical,
  RefreshCw,
  Eye,
  Wrench,
  RotateCcw,
  Check,
  AlertTriangle,
  TrendingDown,
  Activity,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useEvidence, useRecurrence } from '@/hooks/useTrace'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────
// Status colours (dark-theme aware)
// ─────────────────────────────────────────────────────────
const STATUS_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#EF4444', label: 'Critical' },
  warning:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B', label: 'Warning' },
  success:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10B981', label: 'Success' },
  info:     { bg: 'rgba(97,95,255,0.12)',  border: 'rgba(97,95,255,0.3)',  text: '#818CF8', label: 'Info' },
  neutral:  { bg: 'rgba(75,85,99,0.12)',   border: 'rgba(75,85,99,0.3)',   text: '#9CA3AF', label: 'Neutral' },
}

const RECURRENCE_STYLE = {
  Recurring:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#EF4444' },
  Watch:        { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#F59E0B' },
  Chronic:      { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA' },
  Intermittent: { bg: 'rgba(97,95,255,0.12)',   border: 'rgba(97,95,255,0.3)',    text: '#818CF8' },
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function confidenceColor(pct) {
  if (pct >= 90) return '#10B981'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#B7B7B7' }}>
      {children}
    </p>
  )
}

function DataRow({ label, children, className }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</p>
      <div className="text-sm font-semibold" style={{ color: '#F4F4F4' }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
}

function ClassificationBadge({ label, value, Icon }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
      style={{
        background: value ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${value ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <Icon className="w-3 h-3" style={{ color: value ? '#10B981' : '#6B7280' }} />
      <span className="text-xs font-medium" style={{ color: value ? '#10B981' : '#6B7280' }}>
        {label}
      </span>
      {value
        ? <Check className="w-3 h-3 ml-auto" style={{ color: '#10B981' }} />
        : <X className="w-3 h-3 ml-auto" style={{ color: '#6B7280' }} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Evidence item row
// ─────────────────────────────────────────────────────────
function EvidenceRow({ item, onClick }) {
  if (!item) return null

  const typeColor = {
    'Operational Event': '#F59E0B',
    'Meter Reading':     '#10B981',
    'Calculation':       '#615FFF',
    'Weather Data':      '#06B6D4',
    'Inspection Report': '#F97316',
    'SCADA Log':         '#8B5CF6',
  }[item.type] ?? '#6B7280'

  return (
    <button
      onClick={() => onClick?.(item)}
      className="w-full text-left px-3 py-2.5 rounded-lg transition-colors group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(97,95,255,0.08)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      aria-label={`View evidence ${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-mono font-bold text-xs" style={{ color: '#818CF8' }}>{item.id}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}
            >
              {item.type}
            </span>
          </div>
          <p className="text-xs leading-snug truncate" style={{ color: '#B7B7B7' }}>
            {item.description}
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
            {item.asset} · {item.date}
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#615FFF' }} />
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Root / Category detail — simpler layout
// ─────────────────────────────────────────────────────────
function RootOrCategoryDetail({ node, onClose }) {
  const statusStyle = STATUS_STYLE[node.status] ?? STATUS_STYLE.neutral

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
            {node.type === 'root' ? 'Performance Gap' : 'Category'}
          </p>
          <h3 className="text-xl font-bold" style={{ color: '#F4F4F4' }}>{node.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {node.description && (
        <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{node.description}</p>
      )}

      {node.lossGwh != null && (
        <div className="grid grid-cols-2 gap-3">
          <div
            className="p-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#EF4444' }}>Loss</p>
            <p className="text-2xl font-bold" style={{ color: '#F4F4F4' }}>{node.lossGwh.toFixed(1)}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>GWh</p>
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Contribution</p>
            <p className="text-2xl font-bold" style={{ color: '#F4F4F4' }}>{node.contributionPct?.toFixed(1)}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>% of gap</p>
          </div>
        </div>
      )}

      {node.confidence != null && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Model Confidence</p>
            <span className="text-xs font-bold" style={{ color: confidenceColor(node.confidence) }}>
              {node.confidence}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${node.confidence}%`, background: confidenceColor(node.confidence) }}
            />
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: '#6B7280', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        Model-attributed contribution. Not a proven causal claim.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Asset / Evidence detail
// ─────────────────────────────────────────────────────────
function AssetOrEvidenceDetail({ node, allEvidence, onClose, onNavigateEvidence }) {
  const evidenceItems = (node.evidenceIds ?? [])
    .map((id) => allEvidence.find((e) => e.id === id))
    .filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
            {node.type === 'asset' ? 'Asset' : 'Evidence'}
          </p>
          <h3 className="text-lg font-bold" style={{ color: '#F4F4F4' }}>{node.label}</h3>
          {node.sublabel && (
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{node.sublabel}</p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#6B7280' }} aria-label="Close panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {node.description && (
        <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{node.description}</p>
      )}

      {evidenceItems.length > 0 && (
        <div>
          <SectionTitle>Linked Evidence</SectionTitle>
          <div className="space-y-1.5">
            {evidenceItems.map((ev) => (
              <EvidenceRow key={ev.id} item={ev} onClick={onNavigateEvidence} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main cause detail (the full analytical panel)
// ─────────────────────────────────────────────────────────
function CauseDetail({ node, allEvidence, recurrenceData, onClose, onNavigateEvidence, onNavigateRecurrence, onNavigateSimulator }) {
  const statusStyle = STATUS_STYLE[node.status] ?? STATUS_STYLE.neutral
  const rec = node.recurrence
  const recStyle = rec ? (RECURRENCE_STYLE[rec.status] ?? RECURRENCE_STYLE.Intermittent) : null

  const evidenceItems = (node.evidenceIds ?? [])
    .map((id) => allEvidence.find((e) => e.id === id))
    .filter(Boolean)

  // Find matching recurrence record (same id)
  const recurrenceRecord = recurrenceData?.causes?.find((c) => c.id === node.id)

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
            Model-attributed contribution
          </p>
          <h3 className="text-xl font-bold leading-tight" style={{ color: '#F4F4F4' }}>{node.label}</h3>
          {node.category && (
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{node.category}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg shrink-0 transition-colors"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status badge */}
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.text }}
      >
        <Activity className="w-3 h-3" />
        {statusStyle.label}
      </div>

      {node.description && (
        <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{node.description}</p>
      )}

      <Divider />

      {/* ── Core metrics ── */}
      <div>
        <SectionTitle>Attribution</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className="p-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#EF4444' }}>Loss</p>
            <p className="text-2xl font-bold" style={{ color: '#F4F4F4' }}>{node.lossGwh?.toFixed(1) ?? '—'}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>GWh</p>
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Contribution</p>
            <p className="text-2xl font-bold" style={{ color: '#F4F4F4' }}>{node.contributionPct?.toFixed(1) ?? '—'}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>% of gap</p>
          </div>
        </div>

        {/* Confidence */}
        {node.confidence != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Model Confidence</p>
              <span className="text-xs font-bold" style={{ color: confidenceColor(node.confidence) }}>
                {node.confidence}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${node.confidence}%`, background: confidenceColor(node.confidence) }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#4B5563' }}>
              Evidence-supported attribution confidence
            </p>
          </div>
        )}
      </div>

      <Divider />

      {/* ── Classification ── */}
      {node.classification && (
        <div>
          <SectionTitle>Classification</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <ClassificationBadge label="Explainable" value={node.classification.explainable} Icon={Eye} />
            <ClassificationBadge label="Controllable" value={node.classification.controllable} Icon={Wrench} />
            <ClassificationBadge label="Recoverable" value={node.classification.recoverable} Icon={RotateCcw} />
          </div>
        </div>
      )}

      <Divider />

      {/* ── Recurrence ── */}
      {rec && (
        <div>
          <SectionTitle>Recurrence</SectionTitle>
          <div
            className="p-3 rounded-xl"
            style={{ background: recStyle.bg, border: `1px solid ${recStyle.border}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: recStyle.text }}>{rec.status}</span>
              <span className="text-xs font-bold" style={{ color: recStyle.text }}>
                {rec.frequencyPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-2xl font-bold" style={{ color: '#F4F4F4' }}>{rec.occurrences}</span>
              <span className="text-sm pb-0.5" style={{ color: '#9CA3AF' }}>/ {rec.eligiblePeriods} periods</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: rec.eligiblePeriods }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2 rounded-full"
                  style={{
                    background: i < rec.occurrences ? recStyle.text : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
            {recurrenceRecord && (
              <p className="text-[10px] mt-2" style={{ color: '#6B7280' }}>
                Avg loss: {recurrenceRecord.avgLossGwh.toFixed(1)} GWh · Max: {recurrenceRecord.maxLossGwh.toFixed(1)} GWh
              </p>
            )}
          </div>
          {onNavigateRecurrence && (
            <button
              onClick={onNavigateRecurrence}
              className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#9CA3AF',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(97,95,255,0.08)'; e.currentTarget.style.color = '#818CF8' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#9CA3AF' }}
            >
              <span className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" />View recurrence analysis</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── Recovery ── */}
      {node.recovery && (
        <>
          <Divider />
          <div>
            <SectionTitle>Recovery Opportunity</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5 mb-2">
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#10B981' }}>Est. Recovery</p>
                <p className="text-xl font-bold" style={{ color: '#F4F4F4' }}>
                  {node.recovery.potentialGwh?.toFixed(1) ?? '—'}
                </p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>GWh potential</p>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#10B981' }}>Est. Revenue</p>
                <p className="text-xl font-bold" style={{ color: '#F4F4F4' }}>
                  ${((node.recovery.potentialRevenue ?? 0) / 1000).toFixed(0)}K
                </p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>estimated</p>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: '#4B5563' }}>
              Simulated estimate based on recovery model. Not a guaranteed outcome.
            </p>
            {onNavigateSimulator && (
              <button
                onClick={onNavigateSimulator}
                className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#10B981',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
              >
                <span className="flex items-center gap-1.5"><FlaskConical className="w-3 h-3" />Run recovery simulation</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Evidence ── */}
      {evidenceItems.length > 0 && (
        <>
          <Divider />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <SectionTitle>Evidence ({evidenceItems.length})</SectionTitle>
              <button
                onClick={onNavigateEvidence}
                className="text-[10px] font-semibold transition-colors"
                style={{ color: '#615FFF' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#818CF8' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#615FFF' }}
              >
                View all →
              </button>
            </div>
            <div className="space-y-1.5">
              {evidenceItems.map((ev) => (
                <EvidenceRow key={ev.id} item={ev} onClick={onNavigateEvidence} />
              ))}
            </div>
          </div>
        </>
      )}

      <Divider />

      {/* ── Disclaimer ── */}
      <div className="flex gap-2 pt-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#4B5563' }} />
        <p className="text-[10px] leading-relaxed" style={{ color: '#4B5563' }}>
          Model-attributed contribution based on {node.confidence}% confidence attribution model.
          Represents correlated contribution, not proven causality. Evidence-supported attribution.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16 px-4 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(97,95,255,0.12)', border: '1px solid rgba(97,95,255,0.25)' }}
      >
        <TrendingDown className="w-6 h-6" style={{ color: '#615FFF' }} />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1" style={{ color: '#F4F4F4' }}>Select a node</p>
        <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
          Click any cause, asset, or evidence node in the graph to view detailed attribution analysis.
        </p>
      </div>
      <div
        className="w-full p-3 rounded-xl text-xs leading-relaxed"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#6B7280' }}
      >
        <p className="font-semibold mb-1" style={{ color: '#9CA3AF' }}>What you'll see</p>
        <ul className="space-y-1 text-left">
          <li>· Loss contribution &amp; confidence</li>
          <li>· Classification (controllable / recoverable)</li>
          <li>· Recurrence across periods</li>
          <li>· Supporting evidence chain</li>
          <li>· Recovery opportunity estimate</li>
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PUBLIC COMPONENT
// ─────────────────────────────────────────────────────────
/**
 * Right-side detail panel for the Impact Tree.
 * Reads selectedCauseId from ImpactTreeContext and resolves
 * the node from the provided rawNodes list.
 *
 * @param {{ rawNodes: any[] }} props
 */
export function ImpactTreeDetailPanel({ rawNodes }) {
  const { selectedCauseId, selectCause } = useImpactTree()
  const navigate = useNavigate()

  const evidenceQuery = useEvidence()
  const recurrenceQuery = useRecurrence()

  const allEvidence = evidenceQuery.data?.items ?? []
  const recurrenceData = recurrenceQuery.data ?? null

  const selectedNode = rawNodes.find((n) => n.id === selectedCauseId) ?? null

  const handleClose = useCallback(() => {
    selectCause(null)
  }, [selectCause])

  const handleNavigateEvidence = useCallback(() => {
    navigate('/evidence')
  }, [navigate])

  const handleNavigateRecurrence = useCallback(() => {
    navigate('/recurrence')
  }, [navigate])

  const handleNavigateSimulator = useCallback(() => {
    navigate('/simulator')
  }, [navigate])

  return (
    <div
      className="h-full flex flex-col rounded-xl overflow-hidden"
      style={{
        background: '#2A292C',
        border: '1px solid rgba(255,255,255,0.07)',
        minWidth: 280,
      }}
    >
      {/* Panel header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#615FFF' }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B7B7B7' }}>
            {selectedNode ? 'Cause Detail' : 'Detail Panel'}
          </p>
        </div>
        {selectedNode && (
          <button
            onClick={handleClose}
            className="p-1 rounded"
            style={{ color: '#6B7280' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F4F4F4' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280' }}
            aria-label="Close detail panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Panel body — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!selectedNode ? (
          <EmptyState />
        ) : selectedNode.type === 'root' || selectedNode.type === 'category' ? (
          <RootOrCategoryDetail node={selectedNode} onClose={handleClose} />
        ) : selectedNode.type === 'asset' || selectedNode.type === 'evidence' ? (
          <AssetOrEvidenceDetail
            node={selectedNode}
            allEvidence={allEvidence}
            onClose={handleClose}
            onNavigateEvidence={handleNavigateEvidence}
          />
        ) : (
          <CauseDetail
            node={selectedNode}
            allEvidence={allEvidence}
            recurrenceData={recurrenceData}
            onClose={handleClose}
            onNavigateEvidence={handleNavigateEvidence}
            onNavigateRecurrence={handleNavigateRecurrence}
            onNavigateSimulator={selectedNode.classification?.recoverable ? handleNavigateSimulator : null}
          />
        )}
      </div>

      {/* Panel footer — quick actions when cause selected */}
      {selectedNode && selectedNode.type === 'cause' && (
        <div
          className="px-4 py-3 shrink-0 space-y-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={handleNavigateEvidence}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#B7B7B7',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(97,95,255,0.1)'; e.currentTarget.style.color = '#F4F4F4' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#B7B7B7' }}
          >
            <FileSearch className="w-3.5 h-3.5" />
            Open evidence explorer
          </button>
          {selectedNode.classification?.recoverable && (
            <button
              onClick={handleNavigateSimulator}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#10B981',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)' }}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Run recovery simulation
            </button>
          )}
        </div>
      )}
    </div>
  )
}
