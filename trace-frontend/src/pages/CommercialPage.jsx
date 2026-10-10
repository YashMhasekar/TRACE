import ReactECharts from 'echarts-for-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { useCommercial } from '@/hooks/useTrace'

export function CommercialPage() {
  const commercialQuery = useCommercial()

  if (commercialQuery.isLoading) {
    return <LoadingState message="Loading commercial data…" />
  }

  if (commercialQuery.isError) {
    return <ErrorState message="Failed to load commercial data." />
  }

  const { summary, breakdown, note } = commercialQuery.data

  const chartOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { fontSize: 12 },
    },
    series: [
      {
        name: 'Revenue Gap',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          fontSize: 11,
          formatter: '{b}\n{d}%',
        },
        labelLine: {
          show: true,
        },
        data: breakdown.map((item) => ({
          name: item.label,
          value: Math.abs(item.amount),
        })),
        color: ['#f59e0b', '#f97316', '#ef4444', '#dc2626'],
      },
    ],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial"
        subtitle="Revenue breakdown and financial impact analysis."
        badge="Financial Analysis"
        badgeVariant="warning"
      />

      {/* Summary */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Expected Revenue"
            value={`$${(summary.expectedRevenue / 1e6).toFixed(2)}M`}
          />
          <MetricCard
            label="Actual Revenue"
            value={`$${(summary.actualRevenue / 1e6).toFixed(2)}M`}
          />
          <MetricCard
            label="Revenue Gap"
            value={`$${(summary.revenueGap / 1e6).toFixed(2)}M`}
            trend="down"
            trendPositive={false}
            highlight
          />
          <MetricCard
            label="Variance"
            value={summary.revenueGapPct.toFixed(2)}
            unit="%"
            trend="down"
            trendPositive={false}
          />
        </div>
      </section>

      {/* Pie chart */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Revenue Gap Breakdown</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <ReactECharts option={chartOption} style={{ height: '350px' }} />
        </div>
      </section>

      {/* Breakdown table */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Detailed Breakdown</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Component</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">% of Gap</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {breakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{item.label}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md">{item.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      ${(item.amount / 1000).toFixed(0)}K
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.pct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        item.type === 'generation'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Note */}
      {note && (
        <section>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Note:</strong> {note}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
