import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/attribution.json'

export async function fetchAttribution(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    return await apiFetch(`/api/attribution?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
