import { useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, X, LayoutGrid, Maximize2, ChevronDown, ChevronRight } from 'lucide-react'
import { ImpactTreeNode } from './ImpactTreeNode'
import { useImpactTree } from '@/contexts/ImpactTreeContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const NODE_TYPES = { impactNode: ImpactTreeNode }

const NODE_WIDTH = 230
const NODE_HEIGHT = 130
const H_GAP = 50
const V_GAP = 60

const STATUS_COLOR = {
  critical: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#615FFF',
  neutral: '#4B5563',
}

// Edge relationship styles — same for both themes (semantic colours)
const EDGE_STYLE = {
  contributes_to: { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: 'none' },
  supported_by: { stroke: '#615FFF', strokeWidth: 1.5, strokeDasharray: '4 3' },
  related_to: { stroke: '#D1D5DB', strokeWidth: 1, strokeDasharray: '2 4' },
  leads_to: { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: 'none' },
  caused_by: { stroke: '#EF4444', strokeWidth: 1.5, strokeDasharray: 'none' },
}

// ─────────────────────────────────────────────────────────
// Theme token sets
// ─────────────────────────────────────────────────────────
function getThemeTokens(isDark) {
  if (isDark) {
    return {
      graphBg: '#1D1C1E',
      dotColor: '#3A3A3C',
      controlsBg: '#2A292C',
      controlsBorder: 'rgba(255,255,255,0.08)',
      minimapBg: '#2A292C',
      minimapMask: 'rgba(29,28,30,0.7)',
      toolbarBg: 'rgba(42,41,44,0.95)',
      toolbarBorder: 'rgba(255,255,255,0.08)',
      legendBg: 'rgba(42,41,44,0.90)',
      legendBorder: 'rgba(255,255,255,0.06)',
      legendText: '#B7B7B7',
      legendLabel: 'rgba(255,255,255,0.25)',
      searchBg: 'rgba(255,255,255,0.06)',
      searchBorder: 'rgba(255,255,255,0.1)',
      searchText: '#F4F4F4',
      searchPlaceholder: '#6B7280',
      divider: 'rgba(255,255,255,0.1)',
      btnText: 'rgba(255,255,255,0.45)',
      btnHoverText: 'rgba(255,255,255,0.8)',
      matchBg: 'rgba(97,95,255,0.2)',
      matchText: '#818CF8',
      noMatchBg: 'rgba(239,68,68,0.15)',
      noMatchText: '#EF4444',
      titleBadgeBg: 'rgba(42,41,44,0.8)',
      titleBadgeBorder: 'rgba(255,255,255,0.06)',
      titleText: '#B7B7B7',
      outerBorder: 'rgba(255,255,255,0.07)',
      edgeDim: '#1F2937',
    }
  }
  return {
    graphBg: '#F9FAFB',
    dotColor: '#D1D5DB',
    controlsBg: '#FFFFFF',
    controlsBorder: 'rgba(0,0,0,0.10)',
    minimapBg: '#FFFFFF',
    minimapMask: 'rgba(249,250,251,0.7)',
    toolbarBg: 'rgba(255,255,255,0.97)',
    toolbarBorder: 'rgba(0,0,0,0.09)',
    legendBg: 'rgba(255,255,255,0.95)',
    legendBorder: 'rgba(0,0,0,0.07)',
    legendText: '#4B5563',
    legendLabel: '#9CA3AF',
    searchBg: 'rgba(0,0,0,0.04)',
    searchBorder: 'rgba(0,0,0,0.1)',
    searchText: '#111827',
    searchPlaceholder: '#9CA3AF',
    divider: 'rgba(0,0,0,0.08)',
    btnText: '#6B7280',
    btnHoverText: '#111827',
    matchBg: 'rgba(97,95,255,0.1)',
    matchText: '#4F46E5',
    noMatchBg: 'rgba(239,68,68,0.08)',
    noMatchText: '#DC2626',
    titleBadgeBg: 'rgba(255,255,255,0.9)',
    titleBadgeBorder: 'rgba(0,0,0,0.07)',
    titleText: '#6B7280',
    outerBorder: 'rgba(0,0,0,0.08)',
    edgeDim: '#E5E7EB',
  }
}

// ─────────────────────────────────────────────────────────
// Layout algorithm
// ─────────────────────────────────────────────────────────
function computeLayout(nodes, edges, visibleIds) {
  const visible = new Set(visibleIds)
  const visNodes = nodes.filter((n) => visible.has(n.id))
  const visEdges = edges.filter((e) => visible.has(e.source) && visible.has(e.target))

  const parentOf = {}
  const childrenOf = {}
  visEdges.forEach((e) => {
    parentOf[e.target] = e.source
    if (!childrenOf[e.source]) childrenOf[e.source] = []
    childrenOf[e.source].push(e.target)
  })

  const depth = {}
  const queue = []
  const root = visNodes.find((n) => !parentOf[n.id])
  if (!root) return { nodes: visNodes.map((n) => ({ ...n, position: { x: 0, y: 0 } })), edges: visEdges }

  depth[root.id] = 0
  queue.push(root.id)
  while (queue.length > 0) {
    const cur = queue.shift()
    const children = childrenOf[cur] || []
    children.forEach((child) => {
      depth[child] = (depth[cur] ?? 0) + 1
      queue.push(child)
    })
  }

  const byLevel = {}
  visNodes.forEach((n) => {
    const lvl = depth[n.id] ?? 0
    if (!byLevel[lvl]) byLevel[lvl] = []
    byLevel[lvl].push(n)
  })

  const positioned = {}
  Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((lvl) => {
      const nodesAtLevel = byLevel[lvl]
      const totalWidth = nodesAtLevel.length * NODE_WIDTH + (nodesAtLevel.length - 1) * H_GAP
      const startX = -totalWidth / 2
      nodesAtLevel.forEach((node, i) => {
        positioned[node.id] = {
          x: startX + i * (NODE_WIDTH + H_GAP),
          y: lvl * (NODE_HEIGHT + V_GAP),
        }
      })
    })

  return {
    nodes: visNodes.map((n) => ({ ...n, position: positioned[n.id] ?? { x: 0, y: 0 } })),
    edges: visEdges,
  }
}

// ─────────────────────────────────────────────────────────
// Compute visible ids (expand/collapse + search)
// ─────────────────────────────────────────────────────────
function computeVisibleIds(rawNodes, rawEdges, expandedNodeIds, searchQuery) {
  const expanded = new Set(expandedNodeIds)
  const childrenOf = {}
  const parentOf = {}
  rawEdges.forEach((e) => {
    if (!childrenOf[e.source]) childrenOf[e.source] = []
    childrenOf[e.source].push(e.target)
    parentOf[e.target] = e.source
  })

  const visible = new Set(['root'])
  function walkVisible(nodeId) {
    if (expanded.has(nodeId)) {
      ; (childrenOf[nodeId] || []).forEach((childId) => {
        visible.add(childId)
        walkVisible(childId)
      })
    }
  }
  walkVisible('root')

  let filtered = [...visible]
  let searchMatches = new Set()

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    rawNodes.forEach((n) => {
      const hit =
        n.label?.toLowerCase().includes(q) ||
        n.sublabel?.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q) ||
        n.category?.toLowerCase().includes(q) ||
        n.evidenceIds?.some((e) => e.toLowerCase().includes(q))
      if (hit) {
        searchMatches.add(n.id)
        let cur = parentOf[n.id]
        while (cur) { searchMatches.add(cur); cur = parentOf[cur] }
      }
    })
    filtered = filtered.filter((id) => searchMatches.has(id))
  }

  return { visibleIds: new Set(filtered), searchMatches }
}

// ─────────────────────────────────────────────────────────
// Path highlighting
// ─────────────────────────────────────────────────────────
function computeConnectedPath(nodeId, edges) {
  const connectedNodes = new Set([nodeId])
  const connectedEdges = new Set()

  let cur = nodeId, found = true
  while (found) {
    found = false
    edges.forEach((e) => {
      if (e.target === cur && !connectedNodes.has(e.source)) {
        connectedNodes.add(e.source); connectedEdges.add(e.id); cur = e.source; found = true
      }
    })
  }
  const queue = [nodeId]
  while (queue.length) {
    const current = queue.shift()
    edges.forEach((e) => {
      if (e.source === current) {
        if (!connectedNodes.has(e.target)) { connectedNodes.add(e.target); queue.push(e.target) }
        connectedEdges.add(e.id)
      }
    })
  }
  return { nodeIds: [...connectedNodes], edgeIds: [...connectedEdges] }
}

// ─────────────────────────────────────────────────────────
// Inner component
// ─────────────────────────────────────────────────────────
function ImpactTreeInner({ rawNodes, rawEdges, onNodeSelect }) {
  const {
    selectedCauseId, selectCause,
    highlightedNodeIds, highlightedEdgeIds, setHighlight,
    expandedNodeIds, toggleExpanded, expandAll, collapseAll,
    searchQuery, setSearchQuery,
    setGraphViewport,
  } = useImpactTree()

  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = getThemeTokens(isDark)

  const { fitView, getViewport } = useReactFlow()
  const didInit = useRef(false)

  // ── Visible nodes (no category filter — removed per UX decision) ─
  const { visibleIds, searchMatches } = useMemo(
    () => computeVisibleIds(rawNodes, rawEdges, expandedNodeIds, searchQuery),
    [rawNodes, rawEdges, expandedNodeIds, searchQuery],
  )

  // ── Flow nodes ───────────────────────────────────────────
  const flowNodes = useMemo(() => {
    const highlightSet = new Set(highlightedNodeIds)
    // Only dim when there is an active selection AND a non-empty highlight set.
    // If selectedCauseId is null, nothing is ever dimmed regardless of stale state.
    const hasHighlight = !!selectedCauseId && highlightSet.size > 0
    const hasSearch = searchQuery.trim().length > 0

    return rawNodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => {
        const isHighlight = hasHighlight ? highlightSet.has(n.id) : true
        const isSearchHit = hasSearch ? searchMatches.has(n.id) : true
        const dimmed = (hasHighlight && !isHighlight) || (hasSearch && !isSearchHit)

        return {
          id: n.id,
          type: 'impactNode',
          position: { x: 0, y: 0 },
          selected: n.id === selectedCauseId,
          data: {
            ...n,
            _isDark: isDark,
            _isExpanded: expandedNodeIds.includes(n.id),
            _onToggleExpand: toggleExpanded,
            _dimmed: dimmed,
          },
          style: { opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.2s' },
        }
      })
  }, [rawNodes, visibleIds, selectedCauseId, highlightedNodeIds, searchQuery, searchMatches, expandedNodeIds, toggleExpanded, isDark])

  // ── Flow edges ───────────────────────────────────────────
  const flowEdges = useMemo(() => {
    const highlightSet = new Set(highlightedEdgeIds)
    // Mirror the node logic: only dim edges when there is an active selection
    const hasHighlight = !!selectedCauseId && highlightSet.size > 0

    return rawEdges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => {
        const rel = e.relationship || 'contributes_to'
        const styleDef = EDGE_STYLE[rel] || EDGE_STYLE.contributes_to
        const active = !hasHighlight || highlightSet.has(e.id)

        return {
          id: e.id, source: e.source, target: e.target,
          type: 'smoothstep', animated: false,
          style: {
            stroke: active ? styleDef.stroke : t.edgeDim,
            strokeWidth: active ? styleDef.strokeWidth : 1,
            strokeDasharray: styleDef.strokeDasharray === 'none' ? undefined : styleDef.strokeDasharray,
            opacity: active ? 1 : 0.2,
            transition: 'all 0.2s',
          },
          markerEnd: {
            type: 'arrowclosed', width: 12, height: 12,
            color: active ? styleDef.stroke : t.edgeDim,
          },
          data: { relationship: rel },
        }
      })
  }, [rawEdges, visibleIds, selectedCauseId, highlightedEdgeIds, t.edgeDim])

  // ── Layout ───────────────────────────────────────────────
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => computeLayout(flowNodes, flowEdges, [...visibleIds]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(flowNodes.map((n) => n.id)), JSON.stringify(flowEdges.map((e) => e.id))],
  )

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes)
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    onNodesChange(layoutedNodes.map((n) => ({ type: 'reset', item: n })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutedNodes])

  useEffect(() => {
    onEdgesChange(layoutedEdges.map((e) => ({ type: 'reset', item: e })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutedEdges])

  useEffect(() => {
    if (!didInit.current) {
      setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 100)
      didInit.current = true
    }
  }, [fitView])

  const prevVisibleCount = useRef(visibleIds.size)
  useEffect(() => {
    if (prevVisibleCount.current !== visibleIds.size) {
      prevVisibleCount.current = visibleIds.size
      setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 80)
    }
  }, [visibleIds.size, fitView])

  // ── Handlers ─────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (_, node) => {
      const nodeData = node.data
      // Category nodes only expand/collapse — never select or highlight
      if (nodeData.type === 'category') {
        toggleExpanded(node.id)
        return
      }
      const id = node.id
      if (id === selectedCauseId) {
        selectCause(null); setHighlight([], []); onNodeSelect?.(null); return
      }
      selectCause(id)
      const { nodeIds, edgeIds } = computeConnectedPath(id, rawEdges)
      setHighlight(nodeIds, edgeIds)
      onNodeSelect?.(nodeData)
    },
    [selectedCauseId, selectCause, setHighlight, toggleExpanded, rawEdges, onNodeSelect],
  )

  const handlePaneClick = useCallback(() => {
    selectCause(null); setHighlight([], []); onNodeSelect?.(null)
  }, [selectCause, setHighlight, onNodeSelect])

  const handleMoveEnd = useCallback(() => {
    setGraphViewport(getViewport())
  }, [getViewport, setGraphViewport])

  useEffect(() => {
    if (searchQuery.trim() && searchMatches.size > 0) {
      setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 80)
    }
  }, [searchQuery, searchMatches, fitView])

  const allNodeIds = useMemo(() => rawNodes.map((n) => n.id), [rawNodes])
  const handleExpandAll = useCallback(() => expandAll(allNodeIds), [expandAll, allNodeIds])
  const handleCollapseAll = useCallback(() => collapseAll(), [collapseAll])
  const handleFitView = useCallback(() => fitView({ padding: 0.18, duration: 350 }), [fitView])

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="w-full h-full" style={{ background: t.graphBg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        {/* Background dots */}
        <Background color={t.dotColor} gap={20} size={1} variant="dots" />

        {/* Controls */}
        <Controls
          showInteractive={false}
          style={{
            background: t.controlsBg,
            border: `1px solid ${t.controlsBorder}`,
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />

        {/* MiniMap */}
        <MiniMap
          nodeColor={(n) => STATUS_COLOR[n.data?.status] ?? STATUS_COLOR.neutral}
          maskColor={t.minimapMask}
          style={{
            background: t.minimapBg,
            border: `1px solid ${t.controlsBorder}`,
            borderRadius: '10px',
          }}
        />

        {/* ── Top toolbar ── */}
        <Panel position="top-left" style={{ margin: 0, padding: 0 }}>
          <div
            className="flex items-center gap-2 p-2 rounded-xl"
            style={{
              background: t.toolbarBg,
              border: `1px solid ${t.toolbarBorder}`,
              backdropFilter: 'blur(8px)',
              boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.06)',
              marginTop: 8,
              marginLeft: 8,
            }}
          >
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: t.searchPlaceholder }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search causes, assets…"
                className="pl-8 pr-6 py-1.5 text-xs rounded-lg outline-none w-44"
                style={{
                  background: t.searchBg,
                  border: `1px solid ${t.searchBorder}`,
                  color: t.searchText,
                }}
                aria-label="Search graph nodes"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: t.btnText }}
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-5" style={{ background: t.divider }} />

            {/* Expand all */}
            <button
              onClick={handleExpandAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{ color: t.btnText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = t.btnHoverText }}
              onMouseLeave={(e) => { e.currentTarget.style.color = t.btnText }}
              title="Expand all"
              aria-label="Expand all branches"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              All
            </button>

            {/* Collapse all */}
            <button
              onClick={handleCollapseAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{ color: t.btnText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = t.btnHoverText }}
              onMouseLeave={(e) => { e.currentTarget.style.color = t.btnText }}
              title="Collapse all"
              aria-label="Collapse all branches"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Root
            </button>

            {/* Fit view */}
            <button
              onClick={handleFitView}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{ color: t.btnText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = t.btnHoverText }}
              onMouseLeave={(e) => { e.currentTarget.style.color = t.btnText }}
              title="Fit view"
              aria-label="Fit graph to view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Search match count */}
            {searchQuery && searchMatches.size > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: t.matchBg, color: t.matchText }}
              >
                {searchMatches.size} match{searchMatches.size !== 1 ? 'es' : ''}
              </span>
            )}
            {searchQuery && searchMatches.size === 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: t.noMatchBg, color: t.noMatchText }}
              >
                No results
              </span>
            )}
          </div>
        </Panel>

        {/* ── Legend ── */}
        <Panel position="bottom-right" style={{ margin: 0, padding: 0 }}>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs"
            style={{
              background: t.legendBg,
              border: `1px solid ${t.legendBorder}`,
              backdropFilter: 'blur(6px)',
              marginBottom: 8,
              marginRight: 8,
              color: t.legendText,
            }}
          >
            <span
              className="font-semibold uppercase tracking-wider text-[9px]"
              style={{ color: t.legendLabel }}
            >
              Legend
            </span>
            {[
              { color: '#EF4444', label: 'Critical' },
              { color: '#F59E0B', label: 'Warning' },
              { color: '#615FFF', label: 'Info' },
              { color: '#10B981', label: 'Recoverable' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1 ml-1">
              <span className="inline-block w-5 border-b border-dashed" style={{ borderColor: '#615FFF' }} />
              Evidence
            </span>
          </div>
        </Panel>

        {/* ── Title badge ── */}
        <Panel position="top-right" style={{ margin: 0, padding: 0 }}>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{
              background: t.titleBadgeBg,
              border: `1px solid ${t.titleBadgeBorder}`,
              marginTop: 8,
              marginRight: 8,
            }}
          >
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: '#615FFF' }} />
            <span className="text-xs font-medium" style={{ color: t.titleText }}>Impact Tree</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────
export function ImpactTree({ nodes: rawNodes, edges: rawEdges, onNodeSelect, className }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className={cn('w-full rounded-xl overflow-hidden', className)}
      style={{
        height: 580,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <ReactFlowProvider>
        <ImpactTreeInner
          rawNodes={rawNodes}
          rawEdges={rawEdges}
          onNodeSelect={onNodeSelect}
        />
      </ReactFlowProvider>
    </div>
  )
}
