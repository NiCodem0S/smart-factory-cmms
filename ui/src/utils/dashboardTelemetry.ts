import type { DashboardSnapshot, DashboardSummary } from '../types/dashboard'
import type { MachineSimState } from '../types/simulation'
import { telemetryTimestamp } from './telemetrySeries.ts'

const freshTelemetryMs = 60_000

export interface LiveReading {
    at: number
    state: MachineSimState
}

export function withLiveReadings(snapshot: DashboardSnapshot, readings: ReadonlyMap<string, LiveReading>): DashboardSnapshot {
    const generatedAt = telemetryTimestamp(snapshot.generatedAtUtc)
    let newestTime = generatedAt
    let changed = false

    const machines = snapshot.machines.map(machine => {
        const reading = readings.get(machine.id)
        const previousTime = machine.latestTelemetry ? telemetryTimestamp(machine.latestTelemetry.timestampUtc) : 0
        if (!reading || reading.at <= previousTime) {
            return machine
        }

        const { state } = reading
        newestTime = Math.max(newestTime, reading.at)
        changed = true
        return {
            ...machine,
            status: reading.at >= generatedAt ? state.machineStatus : machine.status,
            totalProduced: Math.max(machine.totalProduced, state.totalProduced),
            latestTelemetry: {
                timestampUtc: state.lastTickAtUtc,
                temperature: state.temperature,
                vibration: state.vibration,
                powerLoadKw: state.powerLoadKw,
                networkLatencyMs: null,
            },
        }
    })
    if (!changed) return snapshot

    const summary: DashboardSummary = {
        ...snapshot.summary,
        runningMachines: 0,
        warningMachines: 0,
        errorMachines: 0,
        maintenanceMachines: 0,
        offlineMachines: 0,
        totalProduced: 0,
        powerLoadKw: null,
        averageLatencyMs: null,
        machinesWithPowerReadings: 0,
    }
    const counts = {
        Running: 'runningMachines',
        Warning: 'warningMachines',
        Error: 'errorMachines',
        Maintenance: 'maintenanceMachines',
        Offline: 'offlineMachines',
    } as const
    let latencySum = 0
    let latencyCount = 0
    for (const machine of machines) {
        summary[counts[machine.status]]++
        summary.totalProduced += machine.totalProduced
        const telemetry = machine.latestTelemetry
        if (!telemetry || telemetryTimestamp(telemetry.timestampUtc) < newestTime - freshTelemetryMs) {
            continue
        }
        if (telemetry.powerLoadKw !== null) {
            summary.powerLoadKw = (summary.powerLoadKw ?? 0) + telemetry.powerLoadKw
            summary.machinesWithPowerReadings++
        }
        if (telemetry.networkLatencyMs !== null) {
            latencySum += telemetry.networkLatencyMs
            latencyCount++
        }
    }
    summary.averageLatencyMs = latencyCount ? latencySum / latencyCount : null
    return { ...snapshot, machines, summary }
}
