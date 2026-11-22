import type { TelemetryPoint } from './telemetrySeries'

const minute = 60_000
const clockSteps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720]
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const calendarDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

export function historyTimeLabel(time: number, showDate = false) {
    return showDate ? `${calendarDate.format(time)}, ${clock.format(time)}` : clock.format(time)
}

export function historyRangeLabel(start: number, end: number, showDates = false) {
    const acrossDates = showDates && calendarDate.format(start) !== calendarDate.format(end)
    const separator = acrossDates ? ' – ' : '–'
    return `${historyTimeLabel(start, showDates)}${separator}${historyTimeLabel(end, acrossDates)}`
}

export function dailyTickLabel(time: number, previousTime?: number) {
    const date = calendarDate.format(time)
    return previousTime === undefined || date !== calendarDate.format(previousTime)
        ? [clock.format(time), date]
        : clock.format(time)
}

export function recordedViewport(points: TelemetryPoint[], start: number, end: number) {
    if (!points.length) {
        return { start, end }
    }
    const first = points[0].time
    const last = points[points.length - 1].time
    const span = Math.max(5 * minute, (last - first) * 1.1)
    if (span >= (end - start) * 0.9) {
        return { start, end }
    }
    const left = Math.max(start, Math.min(end - span, (first + last - span) / 2))
    return { start: left, end: left + span }
}

export function metricScale(points: TelemetryPoint[], metric: 'temperature' | 'vibration') {
    let low = Infinity
    let high = -Infinity
    for (const point of points) {
        const value = point[metric]
        if (value === null) {
            continue
        }
        low = Math.min(low, value)
        high = Math.max(high, value)
    }
    if (!Number.isFinite(low)) {
        return metric === 'temperature' ? { min: 20, max: 100, step: 20 } : { min: 0, max: 4, step: 1 }
    }

    // Give flat signals a meaningful range and leave room around peaks.
    const span = Math.max((high - low) * 1.2, metric === 'temperature' ? 4 : 0.4)
    const magnitude = 10 ** Math.floor(Math.log10(span / 4))
    const step = ([1, 2, 2.5, 5, 10].find(n => n * magnitude >= span / 4) ?? 10) * magnitude
    const centre = (low + high) / 2
    const floor = metric === 'vibration' && low >= 0 ? 0 : -Infinity
    const min = Math.max(floor, Math.floor((centre - span / 2) / step) * step)
    const max = Math.max(min + step * 3, Math.ceil((centre + span / 2) / step) * step)
    return { min, max, step }
}

export function historyClockTicks(start: number, end: number, width: number) {
    const slots = Math.max(2, Math.min(8, Math.floor(width / 85)))
    const step = (clockSteps.find(n => n * minute >= (end - start) / slots) ?? 720) * minute
    const offset = new Date(start).getTimezoneOffset() * minute
    const ticks: { value: number }[] = []
    for (let time = Math.ceil((start - offset) / step) * step + offset; time <= end; time += step) {
        ticks.push({ value: time })
    }
    return ticks
}

export function recordedIntervals(points: TelemetryPoint[], maxGapMs: number) {
    const intervals: { start: number; end: number }[] = []
    for (const point of points) {
        const last = intervals[intervals.length - 1]
        if (last && point.time - last.end <= maxGapMs) {
            last.end = point.time
        } else {
            intervals.push({ start: point.time, end: point.time })
        }
    }
    return intervals
}
