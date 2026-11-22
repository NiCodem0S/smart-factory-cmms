import type { MachineSimState, SimulationMachine } from '../types/simulation'

export interface TelemetryPoint {
    time: number
    temperature: number | null
    vibration: number | null
}
export const telemetryWindows = { Live: 1, '1H': 60, '24H': 1440 } as const
export type TelemetryWindow = keyof typeof telemetryWindows

export function telemetryTimestamp(value: string): number {
    // datetime2 in older API responses omitted the UTC suffix. It still represented UTC.
    return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z')
}
const finiteMetric = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

export function telemetryPoint(
    timestamp: string,
    temperature?: number | null,
    vibration?: number | null,
): TelemetryPoint | null {
    const time = telemetryTimestamp(timestamp)
    const point = { time, temperature: finiteMetric(temperature), vibration: finiteMetric(vibration) }
    return Number.isFinite(time) && (point.temperature !== null || point.vibration !== null) ? point : null
}

export function mergeTelemetry(
    history: TelemetryPoint[],
    live: TelemetryPoint[],
    from: number,
    to: number,
): TelemetryPoint[] {
    const points = new Map<number, TelemetryPoint>()
    // Live readings have priority over the SQL sample at the same timestamp.
    for (const point of [...history, ...live]) {
        if (!Number.isFinite(point.time) || point.time < from || point.time > to) {
            continue
        }
        const previous = points.get(point.time)
        points.set(point.time, {
            time: point.time,
            temperature: finiteMetric(point.temperature) ?? previous?.temperature ?? null,
            vibration: finiteMetric(point.vibration) ?? previous?.vibration ?? null,
        })
    }
    return [...points.values()]
        .filter(p => p.temperature !== null || p.vibration !== null)
        .sort((a, b) => a.time - b.time)
}

export function breakTelemetryGaps(points: TelemetryPoint[], maximumGapMs: number): TelemetryPoint[] {
    const result: TelemetryPoint[] = []
    for (let i = 0; i < points.length; i++) {
        if (i > 0 && points[i].time - points[i - 1].time > maximumGapMs) {
            result.push({ time: (points[i - 1].time + points[i].time) / 2, temperature: null, vibration: null })
        }
        result.push(points[i])
    }
    return result
}

export function isolatedTelemetryPoint(
    points: TelemetryPoint[],
    index: number,
    metric: 'temperature' | 'vibration',
): boolean {
    return (
        points[index]?.[metric] != null &&
        points[index - 1]?.[metric] == null &&
        points[index + 1]?.[metric] == null
    )
}

function isNewer(first: MachineSimState | null | undefined, second: MachineSimState | null | undefined) {
    return first != null && second != null && Date.parse(first.lastTickAtUtc) > Date.parse(second.lastTickAtUtc)
}

export function mergeLive(machine: SimulationMachine, state: MachineSimState): SimulationMachine {
    if (machine.machineId !== state.machineId || isNewer(machine.state, state)) {
        return machine
    }
    return {
        ...machine,
        state,
        stateAgeSeconds: 0,
        machineStatus:
            machine.workerStatus === 'Running' && machine.simulationEnabled
                ? state.machineStatus
                : machine.machineStatus,
    }
}

export function mergeSnapshot(previous: SimulationMachine | null | undefined, snapshot: SimulationMachine) {
    if (previous?.machineId === snapshot.machineId && isNewer(previous.state, snapshot.state)) {
        return { ...snapshot, state: previous.state }
    }
    return snapshot
}
