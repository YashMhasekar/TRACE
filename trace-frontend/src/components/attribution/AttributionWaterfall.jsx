import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

/**
 * Attribution waterfall chart showing how Expected → Actual is decomposed across causes.
 *
 * @param {{
 *   data: any[],
 *   selectedId?: string | null,   // shared selectedCauseId from ImpactTreeContext
 *   onBarClick?: (item: any) => void
 * }} props
 */
export function AttributionWaterfall({ data, selectedId, onBarClick }) {
  const option = useMemo(() => {
    const categories = data.map((d) => d.label)
    const values = []
    const assists = []
    let cumulative = data[0]?.value ?? 0

    data.forEach((item) => {
      if (item.type === 'baseline') {
        values.push(item.value)
        assists.push(0)
      } else if (item.type === 'loss') {
        assists.push(cumulative + item.value)
        values.push(-item.value)
        cumulative += item.value
      } else if (item.type === 'total') {
        assists.push(0)
        values.push(item.value)
      } else {
        assists.push(0)
        values.push(0)
      }
    })

    return {
      grid: { top: 40, right: 60, bottom: 80, left: 80 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#2A292C',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#F4F4F4', fontSize: 12 },
        formatter: (params) => {
          const item = data[params[0].dataIndex]
          if (!item) return ''
          let html = `<strong style="color:#F4F4F4">${item.label}</strong><br/>`
          if (item.type === 'baseline') {
            html += `<span style="color:#A5B4FC">${item.value.toFixed(1)} GWh</span>`
          } else if (item.type === 'loss') {
            html += `<span style="color:#FCA5A5">${item.value.toFixed(1)} GWh</span><br/>`
            html += `<span style="color:#F59E0B">${item.contributionPct?.toFixed(1)}% of gap</span>`
            if (item.confidence) {
              html += `<br/><span style="color:#9CA3AF">Confidence: ${item.confidence}%</span>`
            }
          } else if (item.type === 'total') {
            html += `<span style="color:#6EE7B7">${item.value.toFixed(1)} GWh</span>`
          }
          return html
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          interval: 0,
          color: '#9CA3AF',
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value',
        name: 'GWh',
        nameTextStyle: { fontSize: 12, color: '#6B7280' },
        axisLabel: { fontSize: 11, color: '#6B7280' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: 'Assist',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: 'transparent' },
          data: assists,
          emphasis: { disabled: true },
          select: { disabled: true },
        },
        {
          name: 'Value',
          type: 'bar',
          stack: 'total',
          label: {
            show: true,
            position: 'inside',
            formatter: (params) => {
              const val = Math.abs(params.value)
              return val > 1 ? val.toFixed(1) : ''
            },
            fontSize: 11,
            color: '#fff',
          },
          itemStyle: {
            color: (params) => {
              const item = data[params.dataIndex]
              // Selected item: bright primary accent
              if (selectedId && item.id === selectedId) return '#615FFF'
              if (item.type === 'baseline') return '#4F46E5'
              if (item.type === 'total') return '#10B981'
              if (item.type === 'loss') {
                // Dim unselected when something is selected
                if (selectedId && item.id !== selectedId) return 'rgba(245,158,11,0.35)'
                return '#F59E0B'
              }
              return '#6B7280'
            },
            borderRadius: [3, 3, 0, 0],
          },
          data: values,
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(97,95,255,0.4)',
            },
          },
        },
      ],
    }
  }, [data, selectedId])

  const onEvents = useMemo(
    () => ({
      click: (params) => {
        const item = data[params.dataIndex]
        if (item?.type === 'loss' && onBarClick) {
          onBarClick(item)
        }
      },
    }),
    [data, onBarClick],
  )

  return (
    <ReactECharts
      option={option}
      style={{ height: '400px', width: '100%' }}
      onEvents={onEvents}
    />
  )
}
