import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Wrench,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TRACE STATUS COLORS — fixed brand values, no theme variation needed
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  critical: '#EF4444',   // major loss
  warning: '#F59E0B',   // recurring / attention
  success: '#10B981',   // recoverable / healthy
  info: '#615FFF',   // primary brand
  neutral: '#6B7280',
}

const CATEGORY_ICON = {
  Resource: <Zap className="w-3 h-3" />,
  Equipment: <Wrench className="w-3 h-3" />,
  Operations: <Clock className="w-3 h-3" />,
  Grid: <RefreshCw className="w-3 h-3" />,
  Commercial: <FileText className="w-3 h-3" />,
}

const RECURRENCE_STYLE = {
  Recurring: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444', border: 'rgba(239,68,68,0.30)' },
  Watch: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', border: 'rgba(245,158,11,0.30)' },
  Chronic: { bg: 'rgba(97,95,255,0.12)', text: '#A78BFA', border: 'rgba(97,95,255,0.30)' },
  Intermittent: { bg: 'rgba(97,95,255,0.10)', text: '#818CF8', border: 'rgba(97,95,255,0.25)' },
}

function confidenceColor(pct) {
  if (pct >= 90) return '#10B981'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE TOKENS — per theme
//
//  dark:
//    category node bg  → #393939  (card)
//    cause node bg     → #393939  (card)
//    elevated/selected → #2A292C  (card-elevated)
//    evidence bg       → #1D1C1E  (background)
//    border default    → rgba(255,255,255,0.08)
//    handle border     → #1A1A1A
//
//  light:
//    category/cause bg → white
//    elevated          → #F5F5FF
//    evidence bg       → #EEF0FF
//    border default    → rgba(0,0,0,0.08)
//    handle border     → #F9FAFB
// ─────────────────────────────────────────────────────────────────────────────
function surfaceTokens(isDark) {
  if (isDark) {
    return {
      categoryBg: '#393939',
      causeBg: '#393939',
      assetBg: '#393939',
      evidenceBg: '#1D1C1E',
      labelColor: '#F4F4F4',
      subColor: 'rgba(244,244,244,0.45)',
      metaColor: 'rgba(244,244,244,0.38)',
      borderDefault: 'rgba(255,255,255,0.08)',
      handleBorder: '#1A1A1A',
      trackBg: 'rgba(255,255,255,0.10)',
      hoverBg: 'rgba(255,255,255,0.06)',
    }
  }
  return {
    categoryBg: '#FFFFFF',
    causeBg: '#F9FAFB',
    assetBg: '#FFFFFF',
    evidenceBg: '#EEF0FF',
    labelColor: '#111827',
    subColor: '#6B7280',
    metaColor: '#9CA3AF',
    borderDefault: 'rgba(0,0,0,0.08)',
    handleBorder: '#F9FAFB',
    trackBg: 'rgba(0,0,0,0.08)',
    hoverBg: 'rgba(0,0,0,0.04)',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NODE — always #615FFF gradient, white text
// ─────────────────────────────────────────────────────────────────────────────
function RootNode({ data, selected }) {
  return (
    <div
      className="relative px-5 py-4 min-w-[220px] text-center select-none"
      style={{
        background: 'linear-gradient(135deg, #615FFF 0%, #4F46E5 100%)',
        borderRadius: '12px',
        border: selected
          ? '1px solid rgba(255,255,255,0.40)'
          : '1px solid rgba(255,255,255,0.15)',
        boxShadow: selected
          ? '0 0 0 2px #615FFF, 0 4px 18px rgba(97,95,255,0.45)'
          : '0 4px 18px rgba(97,95,255,0.28)',
      }}
      aria-selected={selected}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'rgba(255,255,255,0.80)',
          width: 8, height: 8,
          border: '2px solid #615FFF',
        }}
      />
      <p className="font-bold text-sm text-white leading-tight">{data.label}</p>
      {data.sublabel && (
        <p className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.70)' }}>
          {data.sublabel}
        </p>
      )}
      {data.lossGwh != null && (
        <div
          className="mt-2.5 pt-2.5 grid grid-cols-2 gap-2 text-left"
          style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.50)' }}>Gap</p>
            <p className="text-sm font-bold text-white">{data.lossGwh.toFixed(1)} GWh</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.50)' }}>Confidence</p>
            <p className="text-sm font-bold text-white">{data.confidence ?? 99}%</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY NODE — #393939 card with status left-border accent
// ─────────────────────────────────────────────────────────────────────────────
function CategoryNode({ data, selected, onToggleExpand, isExpanded }) {
  const accent = STATUS_COLOR[data.status] ?? STATUS_COLOR.neutral
  const icon = CATEGORY_ICON[data.category] ?? null
  const s = surfaceTokens(data._isDark !== false)

  const handleToggle = useCallback(
    (e) => { e.stopPropagation(); onToggleExpand?.(data.id) },
    [data.id, onToggleExpand],
  )

  return (
    <div
      className="relative min-w-[190px] select-none"
      style={{
        background: s.categoryBg,
        borderRadius: '10px',
        border: `1px solid ${selected ? accent : s.borderDefault}`,
        borderLeftWidth: '3px',
        borderLeftColor: accent,
        boxShadow: selected
          ? `0 0 0 1px ${accent}44, 0 4px 18px rgba(0,0,0,0.30)`
          : '0 2px 12px rgba(0,0,0,0.20)',
      }}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accent, width: 7, height: 7, border: `2px solid ${s.handleBorder}` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: accent, width: 7, height: 7, border: `2px solid ${s.handleBorder}` }}
      />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {icon && <span style={{ color: accent }}>{icon}</span>}
            <p className="font-bold text-sm leading-tight" style={{ color: s.labelColor }}>
              {data.label}
            </p>
          </div>
          <button
            onClick={handleToggle}
            className="shrink-0 p-0.5 rounded-[4px] transition-colors"
            style={{ color: accent }}
            onMouseEnter={(e) => { e.currentTarget.style.background = s.hoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Loss</p>
            <p className="text-sm font-bold" style={{ color: accent }}>
              {data.lossGwh != null ? `${data.lossGwh.toFixed(1)} GWh` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Share</p>
            <p className="text-sm font-bold" style={{ color: s.labelColor }}>
              {data.contributionPct != null ? `${data.contributionPct.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {data.confidence != null && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Conf.</p>
              <p className="text-[10px] font-semibold" style={{ color: confidenceColor(data.confidence) }}>
                {data.confidence}%
              </p>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: s.trackBg }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.confidence}%`,
                  background: confidenceColor(data.confidence),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE NODE — #393939 with status accent, recurrence + recovery pills
// ─────────────────────────────────────────────────────────────────────────────
function CauseNode({ data, selected }) {
  const accent = STATUS_COLOR[data.status] ?? STATUS_COLOR.neutral
  const rec = data.recurrence
  const recStyle = rec ? (RECURRENCE_STYLE[rec.status] ?? RECURRENCE_STYLE.Intermittent) : null
  const s = surfaceTokens(data._isDark !== false)

  return (
    <div
      className="relative min-w-[200px] max-w-[230px] select-none"
      style={{
        background: s.causeBg,
        borderRadius: '10px',
        border: `1px solid ${selected ? accent : s.borderDefault}`,
        borderLeftWidth: '3px',
        borderLeftColor: accent,
        boxShadow: selected
          ? `0 0 0 1px ${accent}55, 0 4px 18px rgba(0,0,0,0.30)`
          : '0 2px 12px rgba(0,0,0,0.18)',
      }}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accent, width: 7, height: 7, border: `2px solid ${s.handleBorder}` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: accent, width: 7, height: 7, border: `2px solid ${s.handleBorder}` }}
      />

      <div className="px-3.5 py-3">
        <div className="mb-2">
          <p className="font-bold text-sm leading-tight" style={{ color: s.labelColor }}>
            {data.label}
          </p>
          {data.category && (
            <p className="text-[10px] mt-0.5" style={{ color: s.subColor }}>{data.category}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Loss</p>
            <p className="text-sm font-bold" style={{ color: accent }}>
              {data.lossGwh != null ? `${data.lossGwh.toFixed(1)} GWh` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Share</p>
            <p className="text-sm font-bold" style={{ color: s.labelColor }}>
              {data.contributionPct != null ? `${data.contributionPct.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {data.confidence != null && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: s.metaColor }}>Confidence</p>
              <p className="text-[10px] font-semibold" style={{ color: confidenceColor(data.confidence) }}>
                {data.confidence}%
              </p>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: s.trackBg }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${data.confidence}%`, background: confidenceColor(data.confidence) }}
              />
            </div>
          </div>
        )}

        {/* Status pills */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {data.classification?.recoverable && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <RotateCcw className="w-2.5 h-2.5" /> Recoverable
            </span>
          )}
          {rec && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{
                background: recStyle.bg,
                color: recStyle.text,
                border: `1px solid ${recStyle.border}`,
              }}
            >
              <RefreshCw className="w-2.5 h-2.5" /> {rec.occurrences}/{rec.eligiblePeriods}
            </span>
          )}
          {data.evidenceIds?.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{
                background: 'rgba(97,95,255,0.10)',
                color: '#818CF8',
                border: '1px solid rgba(97,95,255,0.20)',
              }}
            >
              <FileText className="w-2.5 h-2.5" /> {data.evidenceIds.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET NODE — compact, same #393939 card surface
// ─────────────────────────────────────────────────────────────────────────────
function AssetNode({ data, selected }) {
  const accent = STATUS_COLOR[data.status] ?? STATUS_COLOR.neutral
  const s = surfaceTokens(data._isDark !== false)

  return (
    <div
      className="relative min-w-[160px] select-none"
      style={{
        background: s.assetBg,
        borderRadius: '8px',
        border: `1px solid ${selected ? accent : s.borderDefault}`,
        borderLeftWidth: '2px',
        borderLeftColor: accent,
        boxShadow: selected
          ? `0 0 0 1px ${accent}44`
          : '0 1px 4px rgba(0,0,0,0.15)',
      }}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accent, width: 6, height: 6, border: `2px solid ${s.handleBorder}` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: accent, width: 6, height: 6, border: `2px solid ${s.handleBorder}` }}
      />

      <div className="px-3 py-2.5 flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: accent }} />
        <div>
          <p className="font-semibold text-xs leading-tight" style={{ color: s.labelColor }}>
            {data.label}
          </p>
          {data.sublabel && (
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: s.subColor }}>
              {data.sublabel}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE NODE — uses background-level color (#1D1C1E dark), purple accent
// ─────────────────────────────────────────────────────────────────────────────
function EvidenceNodeComponent({ data, selected }) {
  const accent = '#615FFF'
  const s = surfaceTokens(data._isDark !== false)

  return (
    <div
      className="relative min-w-[150px] select-none"
      style={{
        background: s.evidenceBg,
        borderRadius: '8px',
        border: selected
          ? `1px solid ${accent}`
          : '1px solid rgba(97,95,255,0.25)',
        boxShadow: selected
          ? `0 0 0 1px ${accent}55, 0 2px 12px rgba(0,0,0,0.25)`
          : '0 1px 4px rgba(0,0,0,0.15)',
      }}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accent, width: 6, height: 6, border: `2px solid ${s.handleBorder}` }}
      />

      <div className="px-3 py-2.5 flex items-start gap-1.5">
        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color: accent }} />
        <div>
          <p className="font-mono font-bold text-xs leading-tight" style={{ color: accent }}>
            {data.label}
          </p>
          {data.sublabel && (
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: s.subColor }}>
              {data.sublabel}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function ImpactTreeNodeComponent(props) {
  const { data, selected } = props

  switch (data.type) {
    case 'root':
      return <RootNode data={data} selected={selected} />
    case 'category':
      return (
        <CategoryNode
          data={data}
          selected={selected}
          onToggleExpand={data._onToggleExpand}
          isExpanded={data._isExpanded}
        />
      )
    case 'cause':
      return <CauseNode data={data} selected={selected} />
    case 'asset':
      return <AssetNode data={data} selected={selected} />
    case 'evidence':
      return <EvidenceNodeComponent data={data} selected={selected} />
    default:
      return <CauseNode data={data} selected={selected} />
  }
}

export const ImpactTreeNode = memo(ImpactTreeNodeComponent)
