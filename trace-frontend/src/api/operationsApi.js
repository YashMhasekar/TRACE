import { apiFetch } from '@/lib/api'
import { isDemoMode } from '@/lib/demoMode'
import fallback from '@/data/operations.json'

const CATEGORY_LABEL = {
  EQUIPMENT_CONVERSION: 'Equipment / Conversion',
  ENVIRONMENTAL: 'Environmental',
  DATA_QUALITY: 'Data Quality',
  UNEXPLAINED: 'Unexplained',
}

const CATEGORY_STATUS = {
  EQUIPMENT_CONVERSION: 'Critical',
  ENVIRONMENTAL: 'Warning',
  DATA_QUALITY: 'Info',
  UNEXPLAINED: 'Info',
}

function transformOperations(raw) {
  const episodes = raw.episodes || []
  if (!episodes.length) return fallback

  const totalVarianceGwh = episodes.reduce((s, e) => s + e.varianceKwh / 1000, 0)
  const controllableLoss = episodes.filter((e) => e.primaryCategory === 'EQUIPMENT_CONVERSION')
    .reduce((s, e) => s + e.varianceKwh / 1000, 0)
  const recoverableLoss = episodes.filter((e) => e.recoveryKwh > 0)
    .reduce((s, e) => s + e.recoveryKwh / 1000, 0)

  // Aggregate by category
  const byCategory = {}
  for (const ep of episodes) {
    const cat = ep.primaryCategory
    if (!byCategory[cat]) byCategory[cat] = { totalLoss: 0, count: 0, confSum: 0 }
    byCategory[cat].totalLoss += ep.varianceKwh / 1000
    byCategory[cat].count += 1
    byCategory[cat].confSum += ep.confidence === 'HIGH' ? 90 : ep.confidence === 'MEDIUM' ? 72 : 50
  }

  const causes = Object.entries(byCategory).map(([cat, agg]) => ({
    id: cat.toLowerCase(),
    cause: CATEGORY_LABEL[cat] || cat,
    category: cat === 'EQUIPMENT_CONVERSION' ? 'Equipment' : cat === 'ENVIRONMENTAL' ? 'Resource' : 'Data',
    lossGwh: +agg.totalLoss.toFixed(3),
    contributionPct: totalVarianceGwh > 0 ? +((agg.totalLoss / totalVarianceGwh) * 100).toFixed(1) : 0,
    controllability: cat === 'EQUIPMENT_CONVERSION' ? 'High' : 'Low',
    recoverability: cat === 'EQUIPMENT_CONVERSION' ? 'High' : 'Low',
    confidence: Math.round(agg.confSum / agg.count),
    frequency: `${agg.count} episodes`,
    status: CATEGORY_STATUS[cat] || 'Info',
    assets: [],
  }))

  const events = [...episodes]
    .sort((a, b) => b.varianceKwh - a.varianceKwh)
    .slice(0, 10)
    .map((ep) => ({
      id: ep.episodeId,
      date: ep.timestampStart?.slice(0, 10) || '',
      asset: ep.primaryCategory === 'EQUIPMENT_CONVERSION' ? 'Inverter' : 'System',
      type: CATEGORY_LABEL[ep.primaryCategory] || ep.primaryCategory,
      duration: `${(ep.durationMinutes / 60).toFixed(1)}h`,
      lossGwh: +(ep.varianceKwh / 1000).toFixed(3),
      cause: CATEGORY_LABEL[ep.primaryCategory] || ep.primaryCategory,
      priority: ep.priority || 'MONITOR',
      confidence: ep.confidence,
    }))

  return {
    summary: {
      totalOperationalLossGwh: +totalVarianceGwh.toFixed(3),
      controllableLossGwh: +controllableLoss.toFixed(3),
      recoverableLossGwh: +recoverableLoss.toFixed(3),
      totalEpisodes: raw.summary?.totalEpisodes || episodes.length,
      highPriorityCount: raw.summary?.highPriorityCount || 0,
    },
    causes,
    events,
  }
}

export async function fetchOperations(plantId = 'PLANT-002') {
  if (isDemoMode()) return fallback
  try {
    const raw = await apiFetch(`/api/operations?plant_id=${plantId}`)
    return transformOperations(raw)
  } catch {
    return fallback
  }
}
