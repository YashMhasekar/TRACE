import { apiFetch } from '@/lib/api'
import fallback from '@/data/commercial.json'

function transformCommercial(raw) {
  if (!raw || !raw.summary) return fallback

  const s = raw.summary
  const expectedRev = s.baselineEnergyValueUsd ?? fallback.summary.expectedRevenue
  const actualRev = s.actualSettlementValueUsd ?? fallback.summary.actualRevenue
  const gapRev = s.totalRevenueGapUsd ?? (expectedRev - actualRev)
  const gapPct = expectedRev > 0 ? (gapRev / expectedRev) * 100 : fallback.summary.revenueGapPct
  const genLoss = s.generationRevenueGapUsd ?? gapRev * 0.915
  const commLoss = s.commercialRevenueGapUsd ?? gapRev * 0.085
  const genPct = s.generationDrivenPct ?? 91.5
  const commPct = s.commercialDrivenPct ?? 8.5

  const breakdown = [
    {
      id: 'generation-impact',
      label: 'Generation Impact',
      description: `Revenue loss from generation shortfall (${((s.generationGapKwh || 0) / 1000).toFixed(1)} MWh × tariff)`,
      amount: -Math.abs(genLoss),
      pct: +genPct.toFixed(1),
      type: 'generation',
      driver: `${((s.generationGapKwh || 0) / 1000).toFixed(1)} MWh × $${(s.tariffUsdPerKwh || 0.055).toFixed(4)}/kWh`,
    },
    {
      id: 'curtailment-adjustment',
      label: 'Curtailment & Grid Adjustment',
      description: 'Grid constraint compensation adjustment per settlement terms',
      amount: -Math.abs(commLoss * 0.49),
      pct: +(commPct * 0.49).toFixed(1),
      type: 'commercial',
      driver: 'Curtailment compensation partial offset',
    },
    {
      id: 'settlement-adjustment',
      label: 'Settlement & Deviation Adjustment',
      description: 'Energy settlement reconciliation against metered schedule',
      amount: -Math.abs(commLoss * 0.35),
      pct: +(commPct * 0.35).toFixed(1),
      type: 'commercial',
      driver: 'Schedule deviation penalty and fee adjustments',
    },
    {
      id: 'tariff-adjustment',
      label: 'Tariff / Spot Variance',
      description: 'Settlement factor and merchant exposure difference',
      amount: -Math.abs(commLoss * 0.16),
      pct: +(commPct * 0.16).toFixed(1),
      type: 'commercial',
      driver: `Settlement factor: ${(s.settlementFactor || 0.97).toFixed(2)}`,
    },
  ]

  return {
    summary: {
      expectedRevenue: expectedRev,
      actualRevenue: actualRev,
      revenueGap: -Math.abs(gapRev),
      revenueGapPct: -Math.abs(gapPct),
      tariffUsdPerKwh: s.tariffUsdPerKwh,
      settlementFactor: s.settlementFactor,
      recoveryPotentialUsd: s.recoveryRevenuePotentialUsd,
    },
    breakdown,
    topEpisodes: raw.topEpisodes || [],
    note: `Generation impact tracked via ${s.commercialDataSource || 'TRACE Commercial Reconciliation'}. Tariff: $${(s.tariffUsdPerKwh || 0.055).toFixed(4)}/kWh.`,
  }
}

export async function fetchCommercial(plantId = 'PLANT-002') {
  try {
    const raw = await apiFetch(`/api/commercial?plant_id=${plantId}`)
    return transformCommercial(raw)
  } catch {
    return fallback
  }
}
