import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/evidence.json'

const CATEGORY_MAP = {
  EQUIPMENT_CONVERSION: { linkedCause: 'Availability', type: 'Operational Event', asset: 'INV-03' },
  ENVIRONMENTAL: { linkedCause: 'Irradiance', type: 'Weather Data', asset: 'MET-01' },
  DATA_QUALITY: { linkedCause: 'Data Quality', type: 'Meter Reading', asset: 'MAIN-METER' },
  UNEXPLAINED: { linkedCause: 'Unexplained', type: 'Calculation', asset: 'SYSTEM' },
}

function transformEvidenceItem(item) {
  const meta = CATEGORY_MAP[item.primaryCategory] || {
    linkedCause: item.primaryCategory || 'General',
    type: 'Operational Event',
    asset: 'SYSTEM',
  }
  const date = item.timestampStart ? item.timestampStart.slice(0, 10) : item.date || '2026-05-18'
  const calc = item.varianceKwh
    ? `Observed variance = ${item.varianceKwh.toFixed(1)} kWh (${item.variancePct?.toFixed(1) ?? 0}% vs expected)`
    : item.calculation || ''

  return {
    id: item.id,
    type: item.type || meta.type,
    source: item.source || (item.evidenceStatus === 'Strong' ? 'SCADA' : 'Attribution Engine'),
    asset: item.asset || meta.asset,
    description: item.proofStatement || item.description || `Episode variance in ${meta.linkedCause}`,
    linkedCause: item.linkedCause || meta.linkedCause,
    date,
    confidence: item.confidence ?? 75,
    calculation: calc,
    tags: item.tags || [item.primaryCategory?.toLowerCase() || 'general'],
    raw: item,
  }
}

export async function fetchEvidence(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    const raw = await apiFetch(`/api/evidence?plant_id=${plantId}`)
    const rawItems = raw.items || []
    const transformed = rawItems.map(transformEvidenceItem)

    // merge with fallback foundational items (CALC-042, MTR-229, etc.)
    const existingIds = new Set(transformed.map((e) => e.id))
    const merged = [...transformed]
    for (const fbItem of fallback.items || []) {
      if (!existingIds.has(fbItem.id)) merged.push(fbItem)
    }
    return { items: merged, total: merged.length }
  } catch {
    return fallback
  }
}

export async function fetchEvidenceById(id) {
  try {
    const all = await fetchEvidence()
    return all.items?.find((e) => e.id === id) ?? null
  } catch {
    return fallback.items?.find((e) => e.id === id) ?? null
  }
}
