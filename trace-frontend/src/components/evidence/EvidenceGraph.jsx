import { useMemo, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEvidence } from '@/hooks/useTrace'

// ─────────────────────────────────────────────────────────
// Node type → visual style (dark TRACE theme)
// ─────────────────────────────────────────────────────────
const TYPE_STYLE = {
  gap: { bg: 'rgba(97,95,255,0.18)', border: '#615FFF', text: '#A5B4FC', label: 'Performance Gap' },
  cause: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', text: '#FCA5A5', label: 'Cause' },
  asset: { bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', text: '#FCD34D', label: 'Asset' },
  event: { bg: 'rgba(239,68,68,0.10)', border: '#F97316', text: '#FDBA74', label: 'Event' },
  meter: { bg: 'rgba(16,185,129,0.10)', border: '#10B981', text: '#6EE7B7', label: 'Meter' },
  weather: { bg: 'rgba(6,182,212,0.10)', border: '#06B6D4', text: '#67E8F9', label: 'Weather' },
  inspection: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', text: '#FDBA74', label: 'Inspection' },
  scada: { bg: 'rgba(139,92,246,0.12)', border: '#8B5CF6', text: '#C4B5FD', label: 'SCADA' },
  calculation: { bg: 'rgba(97,95,255,0.10)', border: '#6366F1', text: '#A5B4FC', label: 'Calculation' },
  attribution: { bg: 'rgba(16,185,129,0.12)', border: '#10B981', text: '#6EE7B7', label: 'Attribution' },
}

// Map evidence item type string → node type key
function evidenceTypeToKey(type) {
  const map = {
    'Operational Event': 'event',
    'Meter Reading': 'meter',
    'Calculation': 'calculation',
    'Weather Data': 'weather',
    'Inspection Report': 'inspection',
    'SCADA Log': 'scada',
  }
  return map[type] ?? 'event'
}

// ─────────────────────────────────────────────────────────
// Build a node style object for React Flow inline styles
// ─────────────────────────────────────────────────────────
function makeNodeStyle(typeKey, selected) {
  const s = TYPE_STYLE[typeKey] ?? TYPE_STYLE.event
  return {
    background: s.bg,
    border: `1.5px solid ${selected ? '#fff' : s.border}`,
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: 600,
    color: s.text,
    minWidth: 130,
    maxWidth: 160,
    textAlign: 'center',
    whiteSpace: 'pre-line',
    boxShadow: selected
      ? `0 0 0 2px ${s.border}88, 0 4px 16px rgba(0,0,0,0.5)`
      : '0 2px 8px rgba(0,0,0,0.35)',
    cursor: 'default',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  }
}

// ─────────────────────────────────────────────────────────
// Build label text for a node
// ─────────────────────────────────────────────────────────
function makeLabel(primary, secondary) {
  return secondary ? `${primary}\n${secondary}` : primary
}

// ─────────────────────────────────────────────────────────
// Build edge style
// ─────────────────────────────────────────────────────────
function makeEdgeStyle(dashed = false) {
  return {
    stroke: dashed ? '#615FFF' : '#4B5563',
    strokeWidth: 1.5,
    strokeDasharray: dashed ? '4 3' : undefined,
  }
}

// ─────────────────────────────────────────────────────────
// Build the graph structure from real evidence data.
// Constructs the chain:
//   Performance Gap → Cause → Asset → Event/Evidence → Calculation → Attribution
// for the given causeId (defaults to 'availability' for the
// full demo chain, since that has the richest evidence).
// ─────────────────────────────────────────────────────────
function buildGraphFromEvidence(evidenceItems, causeId = 'availability') {
  // Resolve which evidence items are relevant to this cause
  const causeLabel =
    causeId === 'availability' ? 'Availability' :
      causeId === 'soiling' ? 'Soiling' :
        causeId === 'curtailment' ? 'Curtailment' :
          causeId === 'irradiance' ? 'Irradiance' :
            causeId === 'degradation' ? 'Degradation' :
              'Availability'

  const causeEvidence = evidenceItems.filter(
    (e) => e.linkedCause === causeLabel || e.linkedCause === 'Performance Gap',
  )

  // Always include CALC-042 (the gap calculation) and MTR-229 (meter)
  const gapCalc = evidenceItems.find((e) => e.id === 'CALC-042')
  const meter = evidenceItems.find((e) => e.id === 'MTR-229')

  // Cause-specific primary evidence
  const primary = causeEvidence.filter(
    (e) => e.id !== 'CALC-042' && e.id !== 'MTR-229',
  )

  const nodes = []
  const edges = []
  let yOffset = 0
  const xCenter = 200

  // ── ROOT: Performance Gap ───────────────────────────────
  nodes.push({
    id: 'n-gap',
    data: { label: makeLabel('Performance Gap', '−23.0 GWh'), typeKey: 'gap' },
    position: { x: xCenter - 75, y: yOffset },
    style: makeNodeStyle('gap', false),
  })
  yOffset += 110

  // ── CAUSE ───────────────────────────────────────────────
  const causeLossMap = {
    Availability: '−5.7 GWh · 94%',
    Soiling: '−3.4 GWh · 88%',
    Curtailment: '−2.9 GWh · 91%',
    Irradiance: '−8.2 GWh · 96%',
    Degradation: '−1.8 GWh · 85%',
  }
  nodes.push({
    id: 'n-cause',
    data: { label: makeLabel(causeLabel, causeLossMap[causeLabel] ?? ''), typeKey: 'cause' },
    position: { x: xCenter - 75, y: yOffset },
    style: makeNodeStyle('cause', false),
  })
  edges.push({
    id: 'e-gap-cause',
    source: 'n-gap',
    target: 'n-cause',
    type: 'smoothstep',
    style: makeEdgeStyle(false),
    markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#4B5563' },
  })
  yOffset += 110

  // ── METER (always shown as parallel data source) ────────
  const meterX = xCenter + 120
  if (meter) {
    nodes.push({
      id: `n-${meter.id}`,
      data: { label: makeLabel(meter.id, '287 GWh actual'), typeKey: 'meter' },
      position: { x: meterX - 65, y: yOffset - 55 },
      style: makeNodeStyle('meter', false),
    })
    edges.push({
      id: `e-cause-${meter.id}`,
      source: 'n-cause',
      target: `n-${meter.id}`,
      type: 'smoothstep',
      style: makeEdgeStyle(true),
      markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#615FFF' },
    })
  }

  // ── PRIMARY EVIDENCE ITEMS ──────────────────────────────
  const primaryNodeIds = []
  const xStep = primary.length > 1 ? 170 : 0
  const xStart = xCenter - ((primary.length - 1) * xStep) / 2

  primary.forEach((ev, i) => {
    const typeKey = evidenceTypeToKey(ev.type)
    const nodeId = `n-${ev.id}`
    primaryNodeIds.push(nodeId)

    nodes.push({
      id: nodeId,
      data: { label: makeLabel(ev.id, ev.asset), typeKey },
      position: { x: xStart + i * xStep - 65, y: yOffset },
      style: makeNodeStyle(typeKey, false),
    })
    edges.push({
      id: `e-cause-${ev.id}`,
      source: 'n-cause',
      target: nodeId,
      type: 'smoothstep',
      style: makeEdgeStyle(false),
      markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#4B5563' },
    })
  })

  if (primary.length > 0) yOffset += 110

  // ── CALCULATION ─────────────────────────────────────────
  if (gapCalc) {
    nodes.push({
      id: `n-${gapCalc.id}`,
      data: { label: makeLabel(gapCalc.id, 'Expected − Actual'), typeKey: 'calculation' },
      position: { x: xCenter - 65, y: yOffset },
      style: makeNodeStyle('calculation', false),
    })

    // Connect all primary evidence → calculation
    primaryNodeIds.forEach((srcId) => {
      edges.push({
        id: `e-${srcId}-calc`,
        source: srcId,
        target: `n-${gapCalc.id}`,
        type: 'smoothstep',
        style: makeEdgeStyle(false),
        markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#4B5563' },
      })
    })

    // Also connect meter → calculation if present
    if (meter) {
      edges.push({
        id: `e-meter-calc`,
        source: `n-${meter.id}`,
        target: `n-${gapCalc.id}`,
        type: 'smoothstep',
        style: makeEdgeStyle(true),
        markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#615FFF' },
      })
    }

    yOffset += 110

    // ── ATTRIBUTION RESULT ────────────────────────────────
    const attrLabelMap = {
      Availability: makeLabel('Attribution', '5.7 GWh contribution'),
      Soiling: makeLabel('Attribution', '3.4 GWh contribution'),
      Curtailment: makeLabel('Attribution', '2.9 GWh contribution'),
      Irradiance: makeLabel('Attribution', '8.2 GWh contribution'),
      Degradation: makeLabel('Attribution', '1.8 GWh contribution'),
    }
    nodes.push({
      id: 'n-attribution',
      data: { label: attrLabelMap[causeLabel] ?? 'Attribution', typeKey: 'attribution' },
      position: { x: xCenter - 65, y: yOffset },
      style: makeNodeStyle('attribution', false),
    })
    edges.push({
      id: 'e-calc-attribution',
      source: `n-${gapCalc.id}`,
      target: 'n-attribution',
      type: 'smoothstep',
      style: makeEdgeStyle(false),
      markerEnd: { type: 'arrowclosed', width: 10, height: 10, color: '#4B5563' },
    })
  }

  return { nodes, edges }
}

// ─────────────────────────────────────────────────────────
// Inner graph (needs ReactFlowProvider above)
// ─────────────────────────────────────────────────────────
function EvidenceGraphInner({ causeId }) {
  const evidenceQuery = useEvidence()
  const items = evidenceQuery.data?.items ?? []

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => buildGraphFromEvidence(items, causeId),
    [items, causeId],
  )

  const [nodes, , onNodesChange] = useNodesState(rawNodes)
  const [edges, , onEdgesChange] = useEdgesState(rawEdges)

  // Update nodes/edges when data changes
  useEffect(() => {
    onNodesChange(rawNodes.map((n) => ({ type: 'reset', item: n })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes])

  useEffect(() => {
    onEdgesChange(rawEdges.map((e) => ({ type: 'reset', item: e })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawEdges])

  if (evidenceQuery.isLoading) {
    return (
      <div
        className="w-full flex items-center justify-center text-sm"
        style={{ height: 380, background: '#1D1C1E', borderRadius: '12px', color: '#6B7280' }}
      >
        Loading evidence chain…
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{ height: 380, background: '#1D1C1E', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#3A3A3C" gap={20} size={1} variant="dots" />
        <Controls
          showInteractive={false}
          style={{
            background: '#2A292C',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────
function EvidenceGraphLegend() {
  const items = [
    { key: 'gap', label: 'Gap' },
    { key: 'cause', label: 'Cause' },
    { key: 'event', label: 'Event' },
    { key: 'meter', label: 'Meter' },
    { key: 'calculation', label: 'Calculation' },
    { key: 'attribution', label: 'Attribution' },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
      {items.map(({ key, label }) => {
        const s = TYPE_STYLE[key]
        return (
          <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            />
            {label}
          </span>
        )
      })}
      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
        <span
          className="inline-block w-5 border-b border-dashed"
          style={{ borderColor: '#615FFF' }}
        />
        Evidence link
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────
/**
 * Evidence chain graph, driven by real evidence.json data.
 *
 * @param {{ causeId?: string }} props
 *   causeId — one of: availability | soiling | curtailment | irradiance | degradation
 *   Defaults to 'availability' (richest evidence chain).
 */
export function EvidenceGraph({ causeId = 'availability' }) {
  return (
    <div>
      <ReactFlowProvider>
        <EvidenceGraphInner causeId={causeId} />
      </ReactFlowProvider>
      <EvidenceGraphLegend />
    </div>
  )
}
