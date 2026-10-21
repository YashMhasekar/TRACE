import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/performance.json'

export async function fetchPerformance(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    return await apiFetch(`/api/performance?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
