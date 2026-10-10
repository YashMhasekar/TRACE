import { apiFetch } from '@/lib/api'
import fallback from '@/data/performance.json'

export async function fetchPerformance(plantId = 'PLANT-002') {
  try {
    return await apiFetch(`/api/performance?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
