import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/simulation.json'

export async function fetchSimulationData(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    return await apiFetch(`/api/simulation?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}

export async function simulateRecovery(causeId, improvementPct) {
  // In demo mode skip the network and run local interpolation immediately
  if (!isDemoMode()) {
    try {
      return await apiFetch('/api/simulation/simulate', {
        method: 'POST',
        body: JSON.stringify({ causeId, improvementPct }),
      })
    } catch {
      // fall through to local interpolation
    }
  }
  // local interpolation fallback
    const data = fallback
    const curve = data.sensitivityCurve[causeId]
    const cause = data.causes.find((c) => c.id === causeId)
    if (!curve || !cause) return null
    const sorted = [...curve].sort((a, b) => a.improvementPct - b.improvementPct)
    const lower = sorted.filter((p) => p.improvementPct <= improvementPct).at(-1) ?? sorted[0]
    const upper = sorted.find((p) => p.improvementPct >= improvementPct) ?? sorted.at(-1)
    let recoveredGwh, recoveredRevenue
    if (lower.improvementPct === upper.improvementPct) {
      recoveredGwh = lower.recoveredGwh
      recoveredRevenue = lower.recoveredRevenue
    } else {
      const t = (improvementPct - lower.improvementPct) / (upper.improvementPct - lower.improvementPct)
      recoveredGwh = +(lower.recoveredGwh + t * (upper.recoveredGwh - lower.recoveredGwh)).toFixed(2)
      recoveredRevenue = Math.round(lower.recoveredRevenue + t * (upper.recoveredRevenue - lower.recoveredRevenue))
    }
    return {
      causeId, cause: cause.label, improvementPct,
      currentLossGwh: cause.currentLossGwh,
      maxRecoverableGwh: cause.maxRecoverableGwh,
      recoveredGwh, recoveredRevenue, isEstimate: true,
    }
}
