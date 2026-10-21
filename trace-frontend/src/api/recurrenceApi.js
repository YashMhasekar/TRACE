import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/recurrence.json'

export async function fetchRecurrence(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    return await apiFetch(`/api/recurrence?plant_id=${plantId}`)
  } catch {
    return fallback
  }
}
