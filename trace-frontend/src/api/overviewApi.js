import { apiFetch } from '@/lib/api'
import overviewFallback from '@/data/overview.json'
import plantsFallback from '@/data/plants.json'

/**
 * Normalize overview data to always use GWh keys.
 * The static fallback JSON stores kWh values (expectedKwh / actualKwh …);
 * the live backend already returns GWh values (expectedGwh / actualGwh …).
 * All pages expect the GWh shape, so we convert once here.
 */
function normalizeOverview(data) {
  const p = data.performance ?? {}

  // Already in GWh format (live backend response)
  if (p.expectedGwh != null) return data

  // Fallback JSON is in kWh — convert to GWh and add revenueGap
  const expectedGwh  = (p.expectedKwh  ?? 0) / 1000
  const actualGwh    = (p.actualKwh    ?? 0) / 1000
  const varianceGwh  = (p.varianceKwh  ?? 0) / 1000
  const tariffPerKwh = 0.055   // synthetic demo tariff ($/kWh)
  const revenueGap   = (p.varianceKwh ?? 0) * tariffPerKwh

  return {
    ...data,
    performance: {
      ...p,
      expectedGwh,
      actualGwh,
      varianceGwh,
      revenueGap,
      recoverableGwh:    (p.recoverableKwh ?? 0) / 1000,
      recoverableRevenue: (p.recoverableKwh ?? 0) * tariffPerKwh,
    },
  }
}

export async function fetchOverview(plantId = 'PLANT-002') {
  try {
    const data = await apiFetch(`/api/overview?plant_id=${plantId}`)
    return normalizeOverview(data)
  } catch {
    return normalizeOverview(overviewFallback)
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
