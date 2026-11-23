import { Activity, ArrowUpRight, Boxes, CheckCircle2, Flame, ShieldAlert, Wrench, Zap } from 'lucide-react'
import type { DashboardSnapshot } from '../../../types/dashboard'
import type { MachineStatus } from '../../../types/machine'
import {
    deriveLineState,
    estimateLineActualUph,
    estimateLineTargetUph,
    isFreshTelemetry,
    lineCode,
    machineCode,
    parseIncidentFact,
    shortHallCode,
} from './operationsHelpers'

export interface PowerHistoryPoint {
    ts: number
    kw: number
}

interface OperationsPulseBentoProps {
    data: DashboardSnapshot
    powerHistory: PowerHistoryPoint[]
    now: number
    statusFilter: MachineStatus | 'All'
    onStatusFilterChange: (status: MachineStatus | 'All') => void
    onInspectMachine: (machineId: string) => void
    onOpenTickets: () => void
}

const STATUS_META: Array<{
    status: MachineStatus
    label: string
    color: string
    bg: string
}> = [
    { status: 'Running', label: 'Running', color: 'var(--sf-running)', bg: 'var(--sf-running-bg)' },
    { status: 'Warning', label: 'Warning', color: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' },
    { status: 'Error', label: 'Error', color: 'var(--sf-error)', bg: 'var(--sf-error-bg)' },
    { status: 'Maintenance', label: 'Maint.', color: 'var(--sf-maint)', bg: 'var(--sf-maint-bg)' },
    { status: 'Offline', label: 'Offline', color: 'var(--sf-offline)', bg: 'var(--sf-offline-bg)' },
]

const HALL_COLORS = ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']
const MAX_INLINE_HALL_LABELS = 3

export default function OperationsPulseBento({
    data,
    powerHistory,
    now,
    statusFilter,
    onStatusFilterChange,
    onInspectMachine,
    onOpenTickets,
}: OperationsPulseBentoProps) {
    const { machines, incidents, summary } = data
    const productionLines = data.productionLines ?? []
    const workOrders = data.workOrders ?? []
    const peakLimitKw = data.peakPowerLimitKw && data.peakPowerLimitKw > 0 ? data.peakPowerLimitKw : 2500

    const total = summary.totalMachines
    const counts: Record<MachineStatus, number> = {
        Running: summary.runningMachines,
        Warning: summary.warningMachines,
        Error: summary.errorMachines,
        Maintenance: summary.maintenanceMachines,
        Offline: summary.offlineMachines,
    }

    let reportingFresh = 0
    let assignedToLine = 0
    const powerByHall = new Map<string, { name: string; kw: number }>()

    for (const m of machines) {
        const fresh = isFreshTelemetry(m, now)
        if (fresh) reportingFresh += 1
        if (m.productionLineId !== null) assignedToLine += 1

        const kw = fresh && m.latestTelemetry?.powerLoadKw !== null ? m.latestTelemetry?.powerLoadKw ?? 0 : 0
        const existingHall = powerByHall.get(m.factoryHallId)
        if (existingHall) {
            existingHall.kw += kw
        } else {
            powerByHall.set(m.factoryHallId, { name: m.factoryHallName, kw })
        }
    }

    const availabilityPct = total > 0 ? Math.round((counts.Running / total) * 100) : 0
    const reportingPct = total > 0 ? Math.round((reportingFresh / total) * 100) : 0
    const assignedPct = total > 0 ? Math.round((assignedToLine / total) * 100) : 0

    const livePowerKw = summary.powerLoadKw
    const totalHallKw = Array.from(powerByHall.values()).reduce((sum, h) => sum + h.kw, 0)
    const peakPct = livePowerKw !== null ? Math.min(100, Math.round((livePowerKw / peakLimitKw) * 1000) / 10) : null

    const hallPowerEntries = Array.from(powerByHall.entries()).map(([id, info], idx) => ({
        id,
        name: info.name,
        code: shortHallCode(info.name, idx),
        kw: info.kw,
        sharePct: totalHallKw > 0 ? (info.kw / totalHallKw) * 100 : 0,
        color: HALL_COLORS[idx % HALL_COLORS.length],
    }))
    const showHallPowerLabels = hallPowerEntries.length > 0 && hallPowerEntries.length <= MAX_INLINE_HALL_LABELS

    // Live rolling power waveform from real snapshots & SignalR updates
    const powerValues = powerHistory.map(p => p.kw)
    const prevPower = powerValues.length > 1 ? powerValues[powerValues.length - 2] : livePowerKw
    const powerDelta =
        livePowerKw !== null && prevPower !== null ? Math.round((livePowerKw - prevPower) * 10) / 10 : null

    const chartW = 220
    const chartH = 44
    const seriesValues = powerValues.length >= 2 ? powerValues : livePowerKw !== null ? [livePowerKw, livePowerKw] : []
    const minP = seriesValues.length ? Math.min(...seriesValues) * 0.9 : 0
    const maxP = seriesValues.length ? Math.max(...seriesValues, 1) * 1.08 : 10
    const pRange = Math.max(maxP - minP, 1)
    const powerCoords = seriesValues.map((val, idx) => ({
        x: seriesValues.length > 1 ? (idx / (seriesValues.length - 1)) * chartW : chartW,
        y: chartH - ((val - minP) / pRange) * (chartH - 10) - 5,
    }))
    const powerLinePath = powerCoords
        .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
        .join(' ')
    const powerAreaPath = powerCoords.length ? `${powerLinePath} L${chartW},${chartH} L0,${chartH} Z` : ''
    const lastCoord = powerCoords[powerCoords.length - 1] ?? null

    // Full 360° circular donut geometry (strokeWidth 25, radius 72.5)
    const ringRadius = 72.5
    const ringCircumference = 2 * Math.PI * ringRadius
    const nonZeroStatuses = STATUS_META.filter(item => counts[item.status] > 0)
    const gapSize = nonZeroStatuses.length > 1 ? 3.8 : 0
    let cumulativeLength = 0
    const donutSegments = nonZeroStatuses.map(item => {
        const rawLen = total > 0 ? (counts[item.status] / total) * ringCircumference : 0
        const visibleLen = Math.max(0, rawLen - gapSize)
        const offset = -cumulativeLength
        cumulativeLength += rawLen
        return {
            status: item.status,
            color: item.color,
            dashArray: `${visibleLen} ${ringCircumference - visibleLen}`,
            dashOffset: offset,
        }
    })

    // Active alerts triage
    const activeIncidents = incidents.filter(i => i.status === 'Active')
    const criticalIncidents = activeIncidents.filter(i => i.severity === 'Critical')
    const warningIncidents = activeIncidents.filter(i => i.severity === 'Warning')
    const totalActiveAlertCount = Math.max(activeIncidents.length, summary.activeCriticalIncidents)
    const hasCritical = summary.activeCriticalIncidents > 0 || criticalIncidents.length > 0
    const topAlert = criticalIncidents[0] ?? warningIncidents[0] ?? null
    const topAlertMachine = topAlert ? machines.find(m => m.id === topAlert.machineId) : null
    const topAlertCode = topAlertMachine ? machineCode(topAlertMachine) : topAlert ? topAlert.machineName.slice(0, 12) : ''
    const topAlertFact = topAlert ? parseIncidentFact(topAlert) : null

    // Work orders summary
    const openWorkOrders = workOrders.filter(w => w.status !== 'Resolved')
    const inProgressOrders = openWorkOrders.filter(w => w.status === 'InProgress').length
    const criticalOrders = openWorkOrders.filter(w => w.type === 'Critical').length

    // Line throughput summary (top 3 lines in scope)
    const lineRows = productionLines.slice(0, 3).map((line, idx) => {
        const stations = machines.filter(m => m.productionLineId === line.id)
        const state = deriveLineState(line, stations)
        const target = estimateLineTargetUph(stations)
        const rate = estimateLineActualUph(state, target)
        const pct = state === 'Running' ? 96 : state === 'Warning' ? 78 : 0
        return {
            id: line.id,
            code: lineCode(line, idx),
            shortName: line.name.split(' ')[0],
            state,
            rate,
            pct,
        }
    })

    return (
        <section className="sf-ops-bento-wrap" aria-label="Operations overview">
            <div className="sf-ops-bento-grid">
                {/* HERO LEFT (row-span-2): Large Circular Donut Fleet Status */}
                <div className="sf-ops-card sf-ops-bento-fleet p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-accent)' }} />
                                <span>Fleet Status</span>
                            </div>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--sf-muted)' }}>
                                Distribution of {total} monitored {total === 1 ? 'machine' : 'machines'}
                            </p>
                        </div>
                        {statusFilter !== 'All' && (
                            <button
                                type="button"
                                onClick={() => onStatusFilterChange('All')}
                                className="text-[11px] font-bold px-2 py-0.5 rounded-lg cursor-pointer transition-colors shrink-0"
                                style={{ background: 'var(--sf-accent-soft)', color: 'var(--sf-accent)' }}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Large Circular Donut + Interactive Status Legend */}
                    <div className="sf-ops-bento-fleet-body flex-1 py-1">
                        <div
                            className="sf-ops-donut-hero relative shrink-0 flex items-center justify-center"
                            role="img"
                            aria-label={`${availabilityPct}% running (${counts.Running} of ${total} machines)`}
                        >
                            <svg viewBox="0 0 192 192" className="w-full h-full">
                                <circle
                                    cx="96"
                                    cy="96"
                                    r={ringRadius}
                                    fill="none"
                                    stroke="var(--sf-border)"
                                    strokeWidth="25"
                                />
                                <g transform="rotate(-90 96 96)">
                                    {donutSegments.map(seg => (
                                        <circle
                                            key={seg.status}
                                            cx="96"
                                            cy="96"
                                            r={ringRadius}
                                            fill="none"
                                            stroke={seg.color}
                                            strokeWidth="25"
                                            strokeLinecap="butt"
                                            strokeDasharray={seg.dashArray}
                                            strokeDashoffset={seg.dashOffset}
                                            style={{
                                                transition: 'stroke-dasharray 420ms ease, stroke-dashoffset 420ms ease, opacity 200ms ease',
                                                opacity: statusFilter !== 'All' && statusFilter !== seg.status ? 0.22 : 1,
                                            }}
                                        />
                                    ))}
                                </g>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                <span className="sf-ops-num text-[32px] font-bold leading-none tracking-[-0.04em]">
                                    {total > 0 ? `${availabilityPct}%` : '—'}
                                </span>
                                <span
                                    className="text-[10.5px] font-bold uppercase tracking-[0.08em] mt-1.5"
                                    style={{ color: 'var(--sf-running)' }}
                                >
                                    Running
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[132px] space-y-1.5 w-full">
                            {STATUS_META.map(item => {
                                const count = counts[item.status]
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                                const isSelected = statusFilter === item.status
                                return (
                                    <button
                                        key={item.status}
                                        type="button"
                                        onClick={() => onStatusFilterChange(isSelected ? 'All' : item.status)}
                                        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer border"
                                        style={{
                                            background: isSelected ? item.bg : 'var(--sf-surface-2)',
                                            borderColor: isSelected ? item.color : 'var(--sf-border)',
                                            opacity: count === 0 && !isSelected ? 0.5 : 1,
                                        }}
                                        title={`Filter dashboard by ${item.status}`}
                                    >
                                        <span className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: item.color }} />
                                            <span className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--sf-text-2)' }}>
                                                {item.label}
                                            </span>
                                        </span>
                                        <span className="flex items-baseline gap-1 shrink-0">
                                            <span className="sf-ops-num text-xs font-extrabold">{count}</span>
                                            <span className="sf-ops-num text-[10px] w-7 text-right" style={{ color: 'var(--sf-muted)' }}>
                                                {pct}%
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Fleet Indicators + Current Shift Footer */}
                    <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--sf-border)' }}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[11px] gap-1">
                                    <span className="truncate" style={{ color: 'var(--sf-muted)' }}>Fresh telemetry</span>
                                    <strong className="sf-ops-num shrink-0">{reportingPct}%</strong>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf-surface-2)' }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${reportingPct}%`, background: '#3b82f6' }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[11px] gap-1">
                                    <span className="truncate" style={{ color: 'var(--sf-muted)' }}>Assigned to line</span>
                                    <strong className="sf-ops-num shrink-0">{assignedPct}%</strong>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf-surface-2)' }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${assignedPct}%`, background: 'var(--sf-running)' }} />
                                </div>
                            </div>
                        </div>

                        {data.currentShift && (
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold truncate" style={{ color: 'var(--sf-text-2)' }}>
                                    {data.currentShift.name}{' '}
                                    <span style={{ color: 'var(--sf-muted)' }}>
                                        ({data.currentShift.startTime}–{data.currentShift.endTime})
                                    </span>
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf-border)' }}>
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${data.currentShift.progressPercent}%`, background: 'var(--sf-accent)' }}
                                        />
                                    </div>
                                    <span className="sf-ops-num text-[10px]" style={{ color: 'var(--sf-muted)' }}>
                                        {data.currentShift.progressPercent}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT TOP-LEFT: Critical Alerts */}
                <div
                    className="sf-ops-card min-w-0 p-4 flex flex-col justify-between gap-2.5 relative overflow-hidden"
                    style={
                        hasCritical
                            ? {
                                  borderColor: 'color-mix(in srgb, var(--sf-error) 46%, var(--sf-border))',
                                  background:
                                      'linear-gradient(155deg, color-mix(in srgb, var(--sf-error) 8.5%, var(--sf-surface)) 0%, var(--sf-surface) 68%)',
                              }
                            : warningIncidents.length > 0
                              ? {
                                    borderColor: 'color-mix(in srgb, var(--sf-warning) 48%, var(--sf-border))',
                                    background:
                                        'linear-gradient(155deg, color-mix(in srgb, var(--sf-warning) 9%, var(--sf-surface)) 0%, var(--sf-surface) 68%)',
                                }
                              : {
                                    borderColor: 'color-mix(in srgb, var(--sf-running) 45%, var(--sf-border))',
                                    background:
                                        'linear-gradient(155deg, color-mix(in srgb, var(--sf-running) 8%, var(--sf-surface)) 0%, var(--sf-surface) 68%)',
                                }
                    }
                >
                    <div className="flex items-center justify-between gap-1.5">
                        <div
                            className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider min-w-0"
                            style={{
                                color: hasCritical
                                    ? 'var(--sf-error)'
                                    : warningIncidents.length > 0
                                      ? 'var(--sf-warning)'
                                      : 'var(--sf-running)',
                            }}
                        >
                            {hasCritical ? (
                                <Flame className="w-3.5 h-3.5 shrink-0" />
                            ) : warningIncidents.length > 0 ? (
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">Critical Alerts</span>
                        </div>

                        {hasCritical && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="sf-ops-beacon-ring absolute inline-flex h-full w-full rounded-full bg-red-500" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                        )}
                    </div>

                    <div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span
                                className="sf-ops-num text-[30px] font-semibold leading-none tracking-[-0.04em]"
                                style={{
                                    color: hasCritical
                                        ? 'var(--sf-error)'
                                        : warningIncidents.length > 0
                                          ? 'var(--sf-warning)'
                                          : 'var(--sf-running)',
                                }}
                            >
                                {totalActiveAlertCount}
                            </span>
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--sf-text-2)' }}>
                                {totalActiveAlertCount === 1 ? 'alert' : 'alerts'}
                            </span>
                        </div>
                        <p className="text-[11px] mt-1 line-clamp-2 leading-snug" style={{ color: 'var(--sf-muted)' }}>
                            {topAlert && topAlertFact
                                ? `${topAlertCode}: ${topAlertFact.metric}${topAlertFact.readingValue ? ` (${topAlertFact.readingValue})` : ''}`
                                : 'All stations inside safe limits.'}
                        </p>
                    </div>

                    {topAlert ? (
                        <button
                            type="button"
                            onClick={() => onInspectMachine(topAlert.machineId)}
                            className="w-full py-1.5 px-2.5 rounded-xl text-[11.5px] font-bold flex items-center justify-between cursor-pointer transition-transform active:scale-[0.98]"
                            style={{
                                background: hasCritical ? 'var(--sf-error)' : 'var(--sf-warning)',
                                color: '#ffffff',
                            }}
                        >
                            <span className="truncate">Focus {topAlertCode}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                    ) : (
                        <div
                            className="w-full py-1.5 px-2.5 rounded-xl text-[11.5px] font-bold text-center"
                            style={{ background: 'var(--sf-running-bg)', color: 'var(--sf-running)' }}
                        >
                            Plant Nominal
                        </div>
                    )}
                </div>

                {/* RIGHT TOP-RIGHT: Active CMMS Work Orders (balanced minimal layout) */}
                <div className="sf-ops-card min-w-0 p-4 flex flex-col justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                        <Wrench className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-accent)' }} />
                        <span className="truncate">Work Orders</span>
                    </div>

                    <div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="sf-ops-num text-[30px] font-semibold leading-none tracking-[-0.04em]">
                                {openWorkOrders.length}
                            </span>
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--sf-text-2)' }}>
                                open
                            </span>
                        </div>
                        <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--sf-muted)' }}>
                            {openWorkOrders.length === 0
                                ? 'No pending service tickets'
                                : criticalOrders > 0
                                  ? `${inProgressOrders} in progress · ${criticalOrders} critical`
                                  : `${inProgressOrders} in progress`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenTickets}
                        className="w-full py-1.5 px-2.5 rounded-xl text-[11.5px] font-bold flex items-center justify-between cursor-pointer transition-colors"
                        style={{
                            background: 'var(--sf-accent-soft)',
                            color: 'var(--sf-accent)',
                        }}
                    >
                        <span className="truncate">Open Tickets</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                </div>

                {/* RIGHT BOTTOM-LEFT: Live Power Draw */}
                <div className="sf-ops-card min-w-0 p-4 flex flex-col justify-between gap-2.5">
                    <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate">Power Draw</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                                <span className="sf-ops-num text-[26px] font-semibold leading-none tracking-[-0.04em]">
                                    {livePowerKw === null ? '—' : livePowerKw.toFixed(1)}
                                </span>
                                <span className="text-[11px] font-medium" style={{ color: 'var(--sf-muted)' }}>kW</span>
                                {powerDelta !== null && powerValues.length > 1 && (
                                    <span
                                        className="sf-ops-num text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                                        style={{
                                            background: powerDelta > 0 ? 'var(--sf-warning-bg)' : 'var(--sf-running-bg)',
                                            color: powerDelta > 0 ? 'var(--sf-warning)' : 'var(--sf-running)',
                                        }}
                                    >
                                        {powerDelta >= 0 ? `+${powerDelta.toFixed(1)}` : powerDelta.toFixed(1)}
                                    </span>
                                )}
                            </div>
                        </div>
                        {peakPct !== null && (
                            <span className="sf-ops-num text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--sf-surface-2)', color: 'var(--sf-muted)' }}>
                                {peakPct}%
                            </span>
                        )}
                    </div>

                    <div className="w-full h-[42px] relative">
                        {powerCoords.length > 0 ? (
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <defs>
                                    <linearGradient id="sf-ops-power-grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.34" />
                                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
                                    </linearGradient>
                                </defs>
                                <path d={powerAreaPath} fill="url(#sf-ops-power-grad)" />
                                <path d={powerLinePath} fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                {lastCoord && (
                                    <circle cx={lastCoord.x} cy={lastCoord.y} r="3.2" fill="#0ea5e9" stroke="var(--sf-surface)" strokeWidth="1.8" />
                                )}
                            </svg>
                        ) : (
                            <div className="h-full flex items-center text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                Waiting for fresh power readings…
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5" style={{ background: 'var(--sf-surface-2)' }}>
                            {hallPowerEntries
                                .filter(h => h.kw > 0)
                                .map(hall => (
                                    <div
                                        key={hall.id}
                                        style={{ width: `${hall.sharePct}%`, background: hall.color }}
                                        title={`${hall.name}: ${hall.kw.toFixed(1)} kW (${Math.round(hall.sharePct)}%)`}
                                    />
                                ))}
                        </div>
                        {showHallPowerLabels && totalHallKw > 0 && (
                            <div className="flex justify-between text-[10.5px] gap-1" style={{ color: 'var(--sf-muted)' }}>
                                {hallPowerEntries.map(hall => (
                                    <span
                                        key={hall.id}
                                        className="flex items-center gap-1 whitespace-nowrap"
                                        title={`${hall.name}: ${hall.kw.toFixed(1)} kW`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-xs inline-block shrink-0" style={{ background: hall.color }} />
                                        {hall.code}{' '}
                                        <strong className="sf-ops-num" style={{ color: 'var(--sf-text-2)' }}>
                                            {hall.kw.toFixed(0)}kW
                                        </strong>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT BOTTOM-RIGHT: Shift Output & Line Takt */}
                <div className="sf-ops-card min-w-0 p-4 flex flex-col justify-between gap-2.5">
                    <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                <Boxes className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                                <span className="truncate">Shift Output</span>
                            </div>
                            <div className="flex items-baseline gap-1 mt-1.5 flex-wrap">
                                <span className="sf-ops-num text-[26px] font-semibold leading-none tracking-[-0.04em]">
                                    {summary.totalProduced.toLocaleString('en-GB')}
                                </span>
                                <span className="text-[11px] font-medium" style={{ color: 'var(--sf-muted)' }}>pcs</span>
                            </div>
                        </div>
                        <span
                            className="sf-ops-num text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: 'var(--sf-running-bg)', color: 'var(--sf-running)' }}
                        >
                            LIVE
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {lineRows.length > 0 ? (
                            lineRows.map(row => {
                                const barColor =
                                    row.state === 'Running'
                                        ? 'var(--sf-running)'
                                        : row.state === 'Warning'
                                          ? 'var(--sf-warning)'
                                          : 'var(--sf-error)'
                                return (
                                    <div key={row.id} className="space-y-0.5">
                                        <div className="flex items-center justify-between text-[10.5px] gap-1.5">
                                            <span className="font-semibold truncate" style={{ color: 'var(--sf-text-2)' }}>
                                                <span className="sf-ops-num opacity-75 mr-1">{row.code}</span>
                                                {row.shortName}
                                            </span>
                                            <span className="sf-ops-num font-bold shrink-0" style={{ color: barColor }}>
                                                {row.state === 'Halted' ? 'HALTED' : `${row.rate} u/h`}
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf-surface-2)' }}>
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${row.pct}%`, background: barColor }}
                                            />
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                Sum of machine production counters
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
