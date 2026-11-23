import type {
    DashboardIncident,
    DashboardMachine,
    DashboardProductionLine,
    DashboardThreshold,
} from '../../../types/dashboard'
import type { MachineStatus } from '../../../types/machine'
import { telemetryTimestamp } from '../../../utils/telemetrySeries'

export const FRESH_TELEMETRY_MS = 60_000

export function machineCode(machine: Pick<DashboardMachine, 'name' | 'serialNumber'>): string {
    const tailMatch = machine.name.match(/\b([A-Z]{2,4}-\d{1,3})\b/)
    if (tailMatch) return tailMatch[1]
    if (machine.serialNumber) {
        const serialBase = machine.serialNumber.split('-')[0]
        if (serialBase && serialBase.length <= 7) return serialBase.toUpperCase()
    }
    return machine.name.slice(0, 6).toUpperCase()
}

export function shortMachineLabel(machine: Pick<DashboardMachine, 'name' | 'serialNumber'>): string {
    const code = machineCode(machine)
    const stripped = machine.name.replace(code, '').trim()
    return stripped || machine.name
}

export function shortHallCode(hallName: string, index: number): string {
    const match =
        hallName.match(/\bHala(?:\s+Główna)?\s+([A-Z0-9]+)\b/i) ??
        hallName.match(/\bHall\s+([A-Z0-9]+)\b/i)
    if (match) return match[1].toUpperCase()
    return `H${index + 1}`
}

export function shortHallPillName(hallName: string): string {
    const hallMatch = hallName.match(/^(Hala(?:\s+Główna)?\s+[A-Z0-9]+|Hall\s+[A-Z0-9]+)/i)
    const parenMatch = hallName.match(/\(([^)]+)\)/)
    if (hallMatch && parenMatch) {
        const firstWord = parenMatch[1].split(/[&,]/)[0].trim().split(/\s+/).slice(0, 2).join(' ')
        const code = hallMatch[1].replace(/Hala\s+Główna/i, 'Hall').replace(/Hala/i, 'Hall')
        return `${code} · ${firstWord}`
    }
    return hallName.length > 22 ? `${hallName.slice(0, 21)}…` : hallName
}

export function isFreshTelemetry(machine: DashboardMachine, nowMs: number): boolean {
    const t = machine.latestTelemetry
    if (!t) return false
    const ts = telemetryTimestamp(t.timestampUtc)
    if (!Number.isFinite(ts)) return false
    const age = Math.max(nowMs, Date.now()) - ts
    const hasMetric = [t.temperature, t.vibration, t.powerLoadKw, t.networkLatencyMs].some(
        v => v !== null && Number.isFinite(v),
    )
    return age >= -5_000 && age <= FRESH_TELEMETRY_MS && hasMetric
}

export function deriveLineState(
    line: DashboardProductionLine | null,
    stations: DashboardMachine[],
): 'Running' | 'Warning' | 'Halted' {
    if (stations.some(s => s.status === 'Error')) return 'Halted'
    if (line?.status === 'Halted') return 'Halted'
    if (stations.length > 0 && stations.every(s => s.status === 'Offline')) return 'Halted'
    if (
        line?.status === 'Warning' ||
        stations.some(s => s.status === 'Warning' || s.status === 'Maintenance')
    ) {
        return 'Warning'
    }
    return 'Running'
}

export function lineCode(line: DashboardProductionLine, index: number): string {
    const hallLetter = shortHallCode(line.factoryHallName, 0)
    const order = line.orderInHall ?? index + 1
    return `LN-${hallLetter}${order}`
}

export function estimateLineTargetUph(stations: DashboardMachine[]): number {
    const cycles = stations.map(s => s.cycleTimeSeconds ?? 0).filter(c => c > 0)
    if (!cycles.length) return 0
    const bottleneckSec = Math.max(...cycles)
    return Math.max(1, Math.round(3600 / bottleneckSec / 4))
}

export function estimateLineActualUph(
    state: 'Running' | 'Warning' | 'Halted',
    targetUph: number,
): number {
    if (state === 'Halted' || targetUph <= 0) return 0
    if (state === 'Warning') return Math.round(targetUph * 0.78)
    return Math.round(targetUph * 0.96)
}

export function parseIncidentFact(incident: DashboardIncident): {
    metric: string
    readingValue: string | null
} {
    const msg = incident.message ?? ''
    const tempMatch = msg.match(/T=([0-9]+(?:\.[0-9]+)?)\s*°?C/i)
    const vibMatch = msg.match(/V=([0-9]+(?:\.[0-9]+)?)\s*mm\/s/i)
    const powerMatch = msg.match(/P=([0-9]+(?:\.[0-9]+)?)\s*kW/i)

    if (/overheat|temp/i.test(msg)) {
        return {
            metric: 'Temperature',
            readingValue: tempMatch ? `${Number(tempMatch[1]).toFixed(1)} °C` : null,
        }
    }
    if (/vibrat|spindle|bearing/i.test(msg)) {
        return {
            metric: 'Vibration',
            readingValue: vibMatch ? `${Number(vibMatch[1]).toFixed(2)} mm/s` : null,
        }
    }
    if (/power|overload|current/i.test(msg)) {
        return {
            metric: 'Power',
            readingValue: powerMatch ? `${Number(powerMatch[1]).toFixed(1)} kW` : null,
        }
    }
    if (/latency|network|packet/i.test(msg)) {
        return { metric: 'Network', readingValue: null }
    }
    if (/maintenance|filter/i.test(msg)) {
        return { metric: 'Maintenance', readingValue: null }
    }
    if (tempMatch) {
        return { metric: 'Telemetry', readingValue: `${Number(tempMatch[1]).toFixed(1)} °C` }
    }
    if (vibMatch) {
        return { metric: 'Telemetry', readingValue: `${Number(vibMatch[1]).toFixed(2)} mm/s` }
    }
    return { metric: incident.severity || 'Alert', readingValue: null }
}

export function formatRelativeTime(timestampUtc: string, nowMs: number): string {
    const ts = telemetryTimestamp(timestampUtc)
    if (!Number.isFinite(ts)) return '—'
    const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000))
    if (diffSec < 15) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 48) return `${diffHr}h ${diffMin % 60}m ago`
    const diffDays = Math.floor(diffHr / 24)
    return `${diffDays}d ago`
}

export function formatDurationSince(timestampUtc: string | null, nowMs: number): string {
    if (!timestampUtc) return 'Active'
    const ts = telemetryTimestamp(timestampUtc)
    if (!Number.isFinite(ts)) return 'Active'
    const diffMin = Math.max(0, Math.floor((nowMs - ts) / 60_000))
    if (diffMin < 60) return `${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m`
    const diffDays = Math.floor(diffHr / 24)
    return `${diffDays}d ${diffHr % 24}h`
}

export function formatWorkOrderStatus(status: string): string {
    if (status === 'InProgress') return 'In Progress'
    return status
}

export function nextWorkOrderStatus(current: string): 'Open' | 'InProgress' | 'Resolved' {
    if (current === 'Open' || current === 'To Do') return 'InProgress'
    if (current === 'InProgress') return 'Resolved'
    return 'Open'
}

export function initialsFromName(fullName: string | null): string {
    if (!fullName || !fullName.trim()) return '—'
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return fullName.slice(0, 2).toUpperCase()
}

export function findThreshold(
    thresholds: DashboardThreshold[],
    machineId: string,
    metric: 'Temperature' | 'Vibration' | 'PowerLoadKw',
): { warn: number | null; crit: number | null } {
    const hit = thresholds.find(
        t => t.machineId === machineId && t.metricType.toLowerCase() === metric.toLowerCase(),
    )
    return hit ? { warn: hit.warningValue, crit: hit.criticalValue } : { warn: null, crit: null }
}

export function statusColorToken(status: MachineStatus): string {
    switch (status) {
        case 'Running':
            return 'var(--sf-running)'
        case 'Warning':
            return 'var(--sf-warning)'
        case 'Error':
            return 'var(--sf-error)'
        case 'Maintenance':
            return 'var(--sf-maint)'
        case 'Offline':
            return 'var(--sf-offline)'
    }
}
