import { createContext, useContext, useState, useCallback, useMemo } from 'react'

/**
 * ImpactTreeContext — shared selection and highlight state across:
 *   ImpactTree graph, AttributionWaterfall, CauseDetailPanel,
 *   EvidencePage, RecurrencePage, RecoverySimulatorPage, AIInvestigatorPage
 *
 * selectedCauseId is the single source of truth for "what is selected".
 * It maps to node.id in impact-tree.json AND to item.id in attribution.json.
 */

const ImpactTreeContext = createContext(null)

export function ImpactTreeProvider({ children }) {
  const [selectedCauseId, setSelectedCauseId] = useState(null)
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([])
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState([])
  const [expandedNodeIds, setExpandedNodeIds] = useState(['root', 'resource', 'equipment', 'operations', 'grid'])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [graphViewport, setGraphViewport] = useState(null)

  /**
   * Select a cause by id (node id or attribution id — they share the same ids).
   * Also accepts null to deselect.
   */
  const selectCause = useCallback((id) => {
    setSelectedCauseId((prev) => (prev === id ? null : id))
    if (!id) {
      setHighlightedNodeIds([])
      setHighlightedEdgeIds([])
    }
  }, [])

  /**
   * Highlight a set of nodes and edges (used by the graph when a path is traced).
   */
  const setHighlight = useCallback((nodeIds, edgeIds) => {
    setHighlightedNodeIds(nodeIds)
    setHighlightedEdgeIds(edgeIds)
  }, [])

  /**
   * Expand or collapse a node branch.
   */
  const toggleExpanded = useCallback((nodeId) => {
    setExpandedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedNodeIds(['root'])
  }, [])

  const expandAll = useCallback((allNodeIds) => {
    setExpandedNodeIds(allNodeIds)
  }, [])

  /**
   * Called by the AI Investigator to programmatically highlight nodes.
   * @param {string[]} nodeIds
   * @param {string[]} edgeIds
   * @param {string|null} primaryNodeId — also sets selectedCauseId
   */
  const applyAIHighlight = useCallback((nodeIds, edgeIds, primaryNodeId) => {
    setHighlightedNodeIds(nodeIds)
    setHighlightedEdgeIds(edgeIds)
    if (primaryNodeId) setSelectedCauseId(primaryNodeId)
  }, [])

  const value = useMemo(
    () => ({
      // Selection
      selectedCauseId,
      selectCause,

      // Path highlighting
      highlightedNodeIds,
      highlightedEdgeIds,
      setHighlight,

      // Expand / collapse
      expandedNodeIds,
      toggleExpanded,
      collapseAll,
      expandAll,

      // Search & filter
      searchQuery,
      setSearchQuery,
      activeCategory,
      setActiveCategory,

      // Viewport (graph remembers position)
      graphViewport,
      setGraphViewport,

      // AI integration
      applyAIHighlight,
    }),
    [
      selectedCauseId,
      selectCause,
      highlightedNodeIds,
      highlightedEdgeIds,
      setHighlight,
      expandedNodeIds,
      toggleExpanded,
      collapseAll,
      expandAll,
      searchQuery,
      activeCategory,
      graphViewport,
      applyAIHighlight,
    ],
  )

  return <ImpactTreeContext.Provider value={value}>{children}</ImpactTreeContext.Provider>
}

export function useImpactTree() {
  const ctx = useContext(ImpactTreeContext)
  if (!ctx) {
    throw new Error('useImpactTree must be used within ImpactTreeProvider')
  }
  return ctx
}
