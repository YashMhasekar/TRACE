import { apiFetch } from '@/lib/api'
import overviewFallback from '@/data/overview.json'
import plantsFallback from '@/data/plants.json'

export async function fetchOverview(plantId = 'PLANT-002') {
  try {
    return await apiFetch(`/api/overview?plant_id=${plantId}`)
  } catch {
    return overviewFallback
  }
}

export async function fetchPlants() {
  try {
    const data = await apiFetch('/api/plants')
    // normalize: backend returns plant_id, frontend also wants id
    const plants = (data.plants ?? []).map((p) => ({
      ...p,
      id: p.plant_id ?? p.id,
    }))
    return plants.length ? plants : plantsFallback.plants
  } catch {
    return plantsFallback.plants
  }
}
