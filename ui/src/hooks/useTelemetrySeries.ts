import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../services/apiClient'
import type { TelemetryReadDto } from '../types/machine'
import type { MachineSimState } from '../types/simulation'
import {
    mergeTelemetry,
    telemetryPoint,
    telemetryTimestamp,
    telemetryWindows,
    type TelemetryPoint,
    type TelemetryWindow,
} from '../utils/telemetrySeries'

interface HistoryResponse {
    toUtc: string
    sampleIntervalSeconds: number
    bucketSeconds: number
    samples: TelemetryReadDto[]
}
const emptyPoints: TelemetryPoint[] = []

interface History {
    key: string
    points: TelemetryPoint[]
    sampleIntervalSeconds: number
    bucketSeconds: number
    offsetMs: number
}

export function useTelemetrySeries(machineId: string, state: MachineSimState | null, window: TelemetryWindow) {
    const minutes = telemetryWindows[window]
    const key = `${machineId}/${minutes}`
    const [history, setHistory] = useState<History | null>(null)
    const [live, setLive] = useState<{ machineId: string; points: TelemetryPoint[] }>({ machineId, points: [] })
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        let pending = false
        setHistory(null)
        setHistoryError(null)
        async function load() {
            if (pending) {
                return
            }
            pending = true
            const requestedAt = Date.now()
            try {
                const { data } = await apiClient.get<HistoryResponse>(`/machines/${machineId}/telemetry/series`, {
                    params: { windowMinutes: minutes },
                    signal: controller.signal,
                })
                if (controller.signal.aborted) {
                    return
                }
                const points = data.samples
                    .map(p => telemetryPoint(p.timestamp, p.temperature, p.vibration))
                    .filter((p): p is TelemetryPoint => p !== null)
                // Estimate server clock offset at the midpoint of the round trip.
                const requestMidpoint = (requestedAt + Date.now()) / 2
                setHistory({
                    key,
                    points,
                    sampleIntervalSeconds: data.sampleIntervalSeconds,
                    bucketSeconds: data.bucketSeconds,
                    offsetMs: telemetryTimestamp(data.toUtc) - requestMidpoint,
                })
                setHistoryError(null)
            } catch {
                if (!controller.signal.aborted) {
                    setHistoryError(
                        'History is temporarily unavailable. Live readings continue to appear on the chart.',
                    )
                }
            } finally {
                pending = false
            }
        }
        void load()
        const timer = setInterval(() => void load(), window === 'Live' ? 5000 : 30000)
        return () => {
            controller.abort()
            clearInterval(timer)
        }
    }, [machineId, minutes, key, window])

    useEffect(() => {
        if (!state || state.machineId !== machineId) {
            return
        }
        const point = telemetryPoint(state.lastTickAtUtc, state.temperature, state.vibration)
        if (!point) {
            return
        }
        setNow(Date.now())
        setLive(current => {
            const previous = current.machineId === machineId ? current.points : emptyPoints
            const points = mergeTelemetry(previous, [point], point.time - 60_000, point.time)
            return { machineId, points }
        })
    }, [machineId, state])

    const matching = history?.key === key ? history : null
    const livePoints = live.machineId === machineId ? live.points : emptyPoints
    const lastLiveTime = livePoints[livePoints.length - 1]?.time
    const end = Math.max(now + (matching?.offsetMs ?? 0), lastLiveTime ?? 0)
    const start = end - minutes * 60000
    const points = useMemo(
        () => mergeTelemetry(matching?.points ?? emptyPoints, livePoints, start, end),
        [matching, livePoints, start, end],
    )
    return {
        points,
        start,
        end,
        historyError,
        loading: !matching && !historyError,
        bucketSeconds: matching?.bucketSeconds ?? 0,
        sampleIntervalSeconds: matching?.sampleIntervalSeconds ?? 5,
    }
}
