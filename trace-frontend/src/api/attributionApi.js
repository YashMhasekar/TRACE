import { apiFetch } from '@/lib/api'
import fallback from '@/data/attribution.json'

export async function fetchAttribution(plantId = 'PLANT-002') {
  try {
    return await apiFetch(`/api/attribution?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
