import ReactECharts from 'echarts-for-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/StateViews'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { useRecurrence } from '@/hooks/useTrace'
import { cn } from '@/lib/utils'

const statusStyles = {
  Recurring:    { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  Watch:        { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  Intermittent: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  Chronic:      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
}

export function RecurrencePage() {
  const recurrenceQuery = useRecurrence()

  if (recurrenceQuery.isLoading) {
    return <LoadingState message="Loading recurrence data…" />
  }

  if (recurrenceQuery.isError) {
    return <ErrorState message="Failed to load recurrence data." />
  }

  const { periods, causes } = recurrenceQuery.data

  // Priority ranking chart
  const priorityChartOption = {
    grid: { top: 30, right: 40, bottom: 80, left: 80 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'category',
      data: causes.map((c) => c.cause),
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: 'Priority Score',
      nameTextStyle: { fontSize: 12 },
    },
    series: [
      {
        name: 'Priority',
        type: 'bar',
        data: causes.map((c) => c.priorityScore),
        itemStyle: {
          color: (params) => {
            const val = params.value
            if (val >= 70) return '#ef4444'
            if (val >= 50) return '#f59e0b'
            return '#6366f1'
          },
        },
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurrence"
        subtitle="Identify recurring problems across historical periods and prioritize recovery actions."
        badge="Recurrence Analysis"
        badgeVariant="warning"
      />

      {/* Priority ranking chart */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Recovery Priority Ranking</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <ReactECharts option={priorityChartOption} style={{ height: '320px' }} />
          <p className="text-xs text-muted-foreground text-center mt-3">
            Priority score = Loss Magnitude × Recurrence × Controllability × Confidence (0–100 normalized)
          </p>
        </div>
      </section>

      {/* Recurrence cards */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Cause Recurrence Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {causes.map((cause) => {
            const style = statusStyles[cause.status] || statusStyles.Intermittent
            return (
              <div key={cause.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{cause.cause}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{cause.category}</p>
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full border text-xs font-semibold',
                      style.bg,
                      style.border,
                      style.text,
                    )}
                  >
                    {cause.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Frequency</p>
                    <p className="font-bold text-foreground text-lg">
                      {cause.occurrences}/{cause.totalPeriods}
                    </p>
                    <p className="text-xs text-muted-foreground">{cause.frequencyPct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Avg Loss</p>
                    <p className="font-bold text-foreground">{cause.avgLossGwh.toFixed(1)} GWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                    <p className="font-bold text-foreground text-lg">{cause.priorityScore}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Controllability</p>
                    <p className="font-medium">{cause.controllability}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                    <ConfidenceBadge value={cause.confidence} showLabel={false} />
                  </div>
                </div>

                {/* Period history */}
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Period History
                  </p>
                  <div className="flex gap-1">
                    {cause.periodData.map((pd) => (
                      <div
                        key={pd.period}
                        className={cn(
                          'flex-1 h-12 rounded border flex flex-col items-center justify-center text-[10px]',
                          pd.occurred
                            ? 'bg-red-50 border-red-200'
                            : 'bg-muted border-border',
                        )}
                        title={`${pd.period}: ${pd.occurred ? `${pd.lossGwh.toFixed(1)} GWh` : 'None'}`}
                      >
                        <span className={cn('font-semibold', pd.occurred ? 'text-red-700' : 'text-muted-foreground')}>
                          {pd.period.slice(0, 3)}
                        </span>
                        {pd.occurred && (
                          <span className="text-red-600 font-bold">{pd.lossGwh.toFixed(1)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
