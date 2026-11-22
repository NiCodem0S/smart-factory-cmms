import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Chart,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
    type ChartDataset,
} from 'chart.js'
import { useTelemetrySeries } from '../../hooks/useTelemetrySeries'
import type { MachineSimState } from '../../types/simulation'
import {
    breakTelemetryGaps,
    isolatedTelemetryPoint,
    telemetryWindows,
    type TelemetryWindow,
} from '../../utils/telemetrySeries'
import {
    dailyTickLabel,
    historyClockTicks,
    historyRangeLabel,
    historyTimeLabel,
    metricScale,
    recordedIntervals,
    recordedViewport,
} from '../../utils/telemetryHistoryView'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend)
type Datum = { x: number; y: number | null }
type TelemetryChart = Chart<'line', Datum[]>
const colors = { temperature: '#ef4444', vibration: '#8b5cf6' }
const axisNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const metrics = [
    { key: 'temperature', label: 'Temperature', unit: '°C', color: '#d84645' },
    { key: 'vibration', label: 'Vibration', unit: 'mm/s', color: '#7950cc' },
] as const
const liveTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
})
function dataset(label: string, color: string, axis: string): ChartDataset<'line', Datum[]> {
    return {
        label,
        data: [],
        yAxisID: axis,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 12,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
        spanGaps: false,
    }
}

function shadeRecordingGaps(
    chart: Pick<TelemetryChart, 'ctx' | 'chartArea' | 'scales'>,
    intervals: ReturnType<typeof recordedIntervals>,
    maxGap: number,
) {
    if (!intervals.length) {
        return
    }
    const {
        ctx,
        chartArea: area,
        scales: { x },
    } = chart
    let previous = x.min
    let widest = 0
    let labelX = 0
    ctx.save()
    ctx.fillStyle = '#f6f8fb'
    function shadeUntil(time: number) {
        if (time - previous <= maxGap) {
            return
        }
        const left = Math.max(area.left, x.getPixelForValue(previous))
        const right = Math.min(area.right, x.getPixelForValue(time))
        const width = right - left
        if (width < 32) {
            return
        }
        ctx.fillRect(left, area.top, width, area.height)
        if (width > widest) {
            widest = width
            labelX = left + width / 2
        }
    }
    for (const interval of intervals) {
        shadeUntil(interval.start)
        previous = interval.end
    }
    shadeUntil(x.max)
    if (widest > 100) {
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillStyle = '#64748b'
        ctx.textAlign = 'center'
        ctx.fillText('No readings', labelX, area.top + 17)
    }
    ctx.restore()
}

export default function TelemetryHistoryChart({
    machineId,
    state,
    tickIntervalMs = 1000,
    connectionStatus,
}: {
    machineId: string
    state: MachineSimState | null
    tickIntervalMs?: number
    connectionStatus: string
}) {
    const [window, setWindow] = useState<TelemetryWindow>('Live')
    const series = useTelemetrySeries(machineId, state, window)
    const canvas = useRef<HTMLCanvasElement>(null)
    const chart = useRef<TelemetryChart | null>(null)
    const daily = window === '24H'
    const historical = window !== 'Live'
    const [fullRange, setFullRange] = useState({ '1H': false, '24H': false })
    const [visible, setVisible] = useState({ temperature: true, vibration: true })
    const maxGap = Math.max(series.bucketSeconds * 1000, series.sampleIntervalSeconds * 1000, tickIntervalMs) * 3
    const data = useMemo(() => breakTelemetryGaps(series.points, maxGap), [series.points, maxGap])
    const intervals = useMemo(
        () => (historical ? recordedIntervals(series.points, maxGap) : []),
        [historical, series.points, maxGap],
    )
    const recording = useRef({ intervals, maxGap })
    const fitted = historical ? recordedViewport(series.points, series.start, series.end) : series
    const canFit = fitted.start > series.start || fitted.end < series.end
    const focused = historical && !fullRange[window] && canFit
    const viewStart = focused ? fitted.start : series.start
    const viewEnd = focused ? fitted.end : series.end
    const timelinePosition = (time: number) => (100 * (time - series.start)) / (series.end - series.start)
    const rangeName = daily ? '24 hours' : 'hour'

    useEffect(() => {
        if (!canvas.current) {
            return
        }
        const instance = new Chart<'line', Datum[]>(canvas.current, {
            type: 'line',
            data: {
                datasets: [
                    dataset('Temperature', colors.temperature, 'temperature'),
                    dataset('Vibration', colors.vibration, 'vibration'),
                ],
            },
            plugins: historical
                ? [
                      {
                          id: 'recordingGaps',
                          beforeDraw: instance =>
                              shadeRecordingGaps(instance, recording.current.intervals, recording.current.maxGap),
                      },
                  ]
                : [],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false,
                normalized: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: !historical,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 9,
                            boxHeight: 9,
                            padding: 18,
                            color: '#64748b',
                            font: { size: 11, weight: 600 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            title: items =>
                                items.length && items[0].parsed.x !== null
                                    ? new Date(items[0].parsed.x).toLocaleString('en-GB')
                                    : '',
                            label: item =>
                                `${item.dataset.label}: ${item.parsed.y?.toLocaleString('en-GB', { maximumFractionDigits: 2 }) ?? '—'} ${item.dataset.yAxisID === 'temperature' ? '°C' : 'mm/s'}`,
                        },
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        grid: { display: false },
                        border: { display: false },
                        afterBuildTicks: scale => {
                            if (historical) {
                                scale.ticks = historyClockTicks(scale.min, scale.max, scale.width)
                            }
                        },
                        ticks: {
                            autoSkip: !historical,
                            maxTicksLimit: historical ? 8 : 5,
                            maxRotation: 0,
                            color: '#64748b',
                            font: { size: historical ? 11 : 10 },
                        },
                    },
                    temperature: {
                        type: 'linear',
                        position: 'left',
                        min: 20,
                        max: 100,
                        grid: { color: '#f1f5f9' },
                        border: { display: false },
                        ticks: {
                            maxTicksLimit: 9,
                            color: '#64748b',
                            font: { size: 10, family: 'monospace' },
                            callback: value => `${value}°C`,
                        },
                    },
                    vibration: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        max: 5,
                        grid: { drawOnChartArea: false },
                        border: { color: '#f1f5f9' },
                        ticks: {
                            maxTicksLimit: 11,
                            color: '#64748b',
                            font: { size: 10, family: 'monospace' },
                            callback: value => `${Number(value).toFixed(1)} mm/s`,
                        },
                    },
                },
            },
        })
        chart.current = instance
        return () => {
            chart.current = null
            instance.destroy()
        }
    }, [historical])

    useEffect(() => {
        const instance = chart.current
        if (!instance) {
            return
        }
        recording.current = { intervals, maxGap }
        instance.data.datasets[0].data = data.map(p => ({ x: p.time, y: p.temperature }))
        instance.data.datasets[1].data = data.map(p => ({ x: p.time, y: p.vibration }))
        const axes = instance.options.scales!
        axes.x!.min = viewStart
        axes.x!.max = viewEnd
        axes.x!.ticks!.callback = (value, index, ticks) => {
            const time = Number(value)
            if (daily) {
                return dailyTickLabel(time, ticks[index - 1]?.value)
            }
            return historical ? historyTimeLabel(time) : liveTime.format(time)
        }
        metrics.forEach(({ key, color }, index) => {
            const line = instance.data.datasets[index]
            line.pointRadius = context =>
                isolatedTelemetryPoint(data, context.dataIndex, key)
                    ? 3
                    : historical && series.points.length <= 12
                      ? 2
                      : 0
            if (!historical) {
                return
            }
            const axis = axes[key]!
            const range = metricScale(series.points, key)
            axis.min = range.min
            axis.max = range.max
            Object.assign(axis.ticks!, {
                stepSize: range.step,
                maxTicksLimit: 7,
                padding: 6,
                color,
                font: { size: 11 },
                callback: (value: string | number) => axisNumber.format(Number(value)),
            })
            line.borderColor = color
            line.pointBackgroundColor = color
            line.pointBorderWidth = 0
            line.tension = 0
            line.cubicInterpolationMode = 'default'
            line.clip = 4
            instance.setDatasetVisibility(index, visible[key])
            axis.display = visible[key]
            axis.grid!.drawOnChartArea = key === 'temperature' || !visible.temperature
        })
        if (!historical) {
            const temperatures = series.points.flatMap(p => (p.temperature === null ? [] : [p.temperature]))
            const vibrations = series.points.flatMap(p => (p.vibration === null ? [] : [p.vibration]))
            axes.temperature!.min = Math.floor(Math.min(20, ...temperatures) / 10) * 10
            axes.temperature!.max = Math.ceil(Math.max(100, ...temperatures) / 10) * 10
            axes.vibration!.max = Math.max(5, Math.ceil(Math.max(5, ...vibrations)))
        }
        instance.update('none')
    }, [data, series.points, viewStart, viewEnd, historical, daily, visible, intervals, maxGap])

    return (
        <section
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            aria-label="Telemetry history"
        >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Telemetry History</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {historical
                            ? `${focused ? 'Recorded span' : `Full ${rangeName}`} · ${historyRangeLabel(viewStart, viewEnd, daily)}`
                            : `${connectionStatus} · last 60 seconds`}
                    </p>
                </div>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Chart time range">
                    {(Object.keys(telemetryWindows) as TelemetryWindow[]).map(range => (
                        <button
                            key={range}
                            aria-pressed={range === window}
                            onClick={() => setWindow(range)}
                            className={`rounded px-3 py-1 text-xs ${range === window ? 'bg-white font-bold text-slate-800 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>
            {historical && (
                <div className="mb-3 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {metrics.map(({ key, label, unit, color }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={visible[key]}
                            disabled={visible[key] && !(visible.temperature && visible.vibration)}
                            onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))}
                            className={`inline-flex items-center gap-1.5 rounded text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-500 ${visible[key] ? 'text-slate-700' : 'text-slate-400 line-through'}`}
                        >
                            <span
                                className="h-[3px] w-4 rounded-full"
                                style={{ backgroundColor: visible[key] ? color : '#cbd5e1' }}
                            />
                            {label} <span className="font-normal text-slate-500">{unit}</span>
                        </button>
                    ))}
                    {canFit && (
                        <button
                            type="button"
                            onClick={() => setFullRange(ranges => ({ ...ranges, [window]: !ranges[window] }))}
                            className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                            {focused ? `Show full ${rangeName}` : 'Fit to readings'}
                        </button>
                    )}
                </div>
            )}
            <div
                className={`relative min-w-0 w-full ${historical ? 'h-[232px] sm:h-[260px]' : 'h-[300px]'}`}
                data-telemetry-points={series.points.length}
            >
                <canvas
                    ref={canvas}
                    role="img"
                    className={historical && !series.points.length ? 'invisible' : undefined}
                    aria-label="Combined temperature and vibration chart. Left axis: °C. Right axis: mm/s."
                />
                {series.points.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-sm text-slate-400">
                        {series.loading
                            ? 'Loading readings…'
                            : `No readings for ${window === 'Live' ? 'the last 60 seconds' : 'the selected period'}.`}
                    </div>
                )}
            </div>
            {historical && series.points.length > 0 && (
                <div
                    className={`mt-4 text-[11px] text-slate-500 ${
                        daily ? 'rounded-lg bg-slate-50 p-3' : 'border-t border-slate-100 pt-3'
                    }`}
                >
                    {daily && (
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <span className="font-semibold text-slate-700">24-hour recording activity</span>
                            {series.bucketSeconds > 0 && (
                                <span>Last reading per {series.bucketSeconds / 60} min bucket</span>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {!daily && <span className="font-medium">Recording activity</span>}
                        <span className="tabular-nums">{historyTimeLabel(series.start, daily)}</span>
                        <div
                            className="relative h-2 min-w-10 flex-1 overflow-hidden rounded-full bg-slate-200/70"
                            aria-hidden="true"
                        >
                            {focused && (
                                <div
                                    className={`absolute inset-y-0 rounded-sm ${daily ? 'bg-blue-200' : 'bg-slate-200'}`}
                                    style={{
                                        left: `${timelinePosition(viewStart)}%`,
                                        width: `${timelinePosition(viewEnd) - timelinePosition(viewStart)}%`,
                                    }}
                                />
                            )}
                            {intervals.map(interval => (
                                <span
                                    key={interval.start}
                                    className={`absolute inset-y-0.5 min-w-px rounded-full ${daily ? 'bg-blue-600' : 'bg-slate-500'}`}
                                    style={{
                                        left: `min(${timelinePosition(interval.start)}%, calc(100% - 1px))`,
                                        width: `${timelinePosition(interval.end) - timelinePosition(interval.start)}%`,
                                    }}
                                />
                            ))}
                        </div>
                        <span className="tabular-nums">{historyTimeLabel(series.end, daily)}</span>
                    </div>
                </div>
            )}
            {!historical && (
                <div className="mt-2 flex min-h-4 flex-wrap justify-between gap-2 text-[11px] text-slate-400">
                    <span>Temperature: left axis · vibration: right axis. Gaps indicate missing readings.</span>
                    {series.bucketSeconds > 0 && (
                        <span>
                            History: last reading every{' '}
                            {series.bucketSeconds < 60
                                ? `${series.bucketSeconds} s`
                                : `${series.bucketSeconds / 60} min`}
                            .
                        </span>
                    )}
                </div>
            )}
            {series.historyError && (
                <p role="status" className="mt-2 text-xs text-amber-700">
                    {series.historyError}
                </p>
            )}
        </section>
    )
}
