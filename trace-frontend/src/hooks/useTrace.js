/**
 * TRACE data hooks — TanStack Query wrappers over the API abstraction layer.
 * All queries include activePlantId so switching plant refetches everything.
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import { usePlantContext } from '@/contexts/PlantContext'
import { fetchOverview, fetchPlants } from '@/api/overviewApi'
import { fetchPerformance } from '@/api/performanceApi'
import { fetchAttribution } from '@/api/attributionApi'
import { fetchEvidence, fetchEvidenceById } from '@/api/evidenceApi'
import { fetchRecurrence } from '@/api/recurrenceApi'
import { fetchSimulationData, simulateRecovery } from '@/api/recoveryApi'
import { fetchCommercial } from '@/api/commercialApi'
import { fetchOperations } from '@/api/operationsApi'
import { fetchImpactTree } from '@/api/impactTreeApi'
import { fetchSuggestedQuestions, investigate, streamChat, sendChat } from '@/api/aiApi'

export const QUERY_KEYS = {
  overview: (pid) => ['overview', pid],
  plants: ['plants'],
  performance: (pid) => ['performance', pid],
  attribution: (pid) => ['attribution', pid],
  evidence: (pid) => ['evidence', pid],
  evidenceById: (pid, id) => ['evidence', pid, id],
  recurrence: (pid) => ['recurrence', pid],
  simulationData: (pid) => ['simulation', pid],
  commercial: (pid) => ['commercial', pid],
  operations: (pid) => ['operations', pid],
  impactTree: (pid) => ['impactTree', pid],
  suggestedQuestions: ['ai', 'suggestions'],
  modelStatus: (pid) => ['model-status', pid],
}

export function useOverview() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.overview(activePlantId),
    queryFn: () => fetchOverview(activePlantId),
  })
}

export function usePlants() {
  return useQuery({ queryKey: QUERY_KEYS.plants, queryFn: fetchPlants })
}

export function usePerformance() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.performance(activePlantId),
    queryFn: () => fetchPerformance(activePlantId),
  })
}

export function useAttribution() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.attribution(activePlantId),
    queryFn: () => fetchAttribution(activePlantId),
  })
}

export function useEvidence() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.evidence(activePlantId),
    queryFn: () => fetchEvidence(activePlantId),
  })
}

export function useEvidenceById(id) {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.evidenceById(activePlantId, id),
    queryFn: () => fetchEvidenceById(id),
    enabled: !!id,
  })
}

export function useRecurrence() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.recurrence(activePlantId),
    queryFn: () => fetchRecurrence(activePlantId),
  })
}

export function useSimulationData() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.simulationData(activePlantId),
    queryFn: () => fetchSimulationData(activePlantId),
  })
}

export function useCommercial() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.commercial(activePlantId),
    queryFn: () => fetchCommercial(activePlantId),
  })
}

export function useOperations() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.operations(activePlantId),
    queryFn: () => fetchOperations(activePlantId),
  })
}

export function useImpactTree() {
  const { activePlantId } = usePlantContext()
  return useQuery({
    queryKey: QUERY_KEYS.impactTree(activePlantId),
    queryFn: () => fetchImpactTree(activePlantId),
  })
}

export function useSuggestedQuestions() {
  return useQuery({ queryKey: QUERY_KEYS.suggestedQuestions, queryFn: fetchSuggestedQuestions })
}

/** Mutation — simulate recovery */
export function useSimulateRecovery() {
  return useMutation({
    mutationFn: ({ causeId, improvementPct }) => simulateRecovery(causeId, improvementPct),
  })
}

/** Mutation — AI investigation (legacy single-question, kept for compat) */
export function useInvestigate() {
  return useMutation({
    mutationFn: (question) => investigate(question),
  })
}

/** Mutation — send a full conversation to Grok (non-streaming) */
export function useSendChat() {
  return useMutation({
    mutationFn: (messages) => sendChat(messages),
  })
}

/**
 * Returns the streamChat function directly — not a TanStack hook because
 * streaming doesn't fit the request/response model.
 * Usage: const stream = useStreamChat(); stream(messages, onChunk, onDone, onError)
 */
export function useStreamChat() {
  return streamChat
}
