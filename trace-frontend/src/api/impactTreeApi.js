import { apiFetch } from '@/lib/api'
import fallback from '@/data/impact-tree.json'

function mergeTreeData(apiData) {
  if (!apiData || !apiData.nodes) return fallback

  const fallbackNodeMap = new Map((fallback.nodes || []).map((n) => [n.id, n]))

  const mergedNodes = apiData.nodes.map((apiNode) => {
    const fb = fallbackNodeMap.get(apiNode.id) || {}
    return {
      ...fb,
      ...apiNode,
      classification: apiNode.classification || fb.classification || {
        explainable: true, controllable: false, recoverable: false,
      },
      recurrence: apiNode.recurrence || fb.recurrence || null,
      recovery: apiNode.recovery || fb.recovery || null,
      evidenceIds: apiNode.evidenceIds || fb.evidenceIds || [],
      description: apiNode.description || fb.description || apiNode.sublabel || '',
      lossGwh: apiNode.lossGwh ?? fb.lossGwh ?? 0,
      confidence: apiNode.confidence ?? fb.confidence ?? 85,
    }
  })

  // add any fallback nodes not returned by the API
  const existingIds = new Set(mergedNodes.map((n) => n.id))
  for (const fbNode of fallback.nodes || []) {
    if (!existingIds.has(fbNode.id)) mergedNodes.push(fbNode)
  }

  // merge edges
  const existingEdgeIds = new Set((apiData.edges || []).map((e) => e.id))
  const mergedEdges = [...(apiData.edges || [])]
  for (const fbEdge of fallback.edges || []) {
    if (!existingEdgeIds.has(fbEdge.id)) mergedEdges.push(fbEdge)
  }

  return {
    rootId: apiData.rootId || fallback.rootId || 'root',
    metadata: { ...fallback.metadata, ...(apiData.metadata || {}) },
    nodes: mergedNodes,
    edges: mergedEdges,
  }
}

export async function fetchImpactTree(plantId = 'PLANT-002') {
  try {
    const data = await apiFetch(`/api/impact-tree?plant_id=${plantId}`)
    return mergeTreeData(data)
  } catch {
    return fallback
  }
}
