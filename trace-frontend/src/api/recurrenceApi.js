import { apiFetch } from '@/lib/api'
import fallback from '@/data/recurrence.json'

export async function fetchRecurrence(plantId = 'PLANT-002') {
  try {
    return await apiFetch(`/api/recurrence?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
