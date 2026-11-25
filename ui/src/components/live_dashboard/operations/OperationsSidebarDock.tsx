import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowUpRight,
    Bell,
    Check,
    Clock,
    Cpu,
    Play,
    Radio,
    RotateCcw,
    Send,
    Wrench,
    X,
} from 'lucide-react'
import type {
    DashboardIncident,
    DashboardMachine,
    DashboardProductionLine,
    DashboardThreshold,
    DashboardWorkOrder,
} from '../../../types/dashboard'
import type { TelemetryReadDto } from '../../../types/machine'
import { fetchMachineTelemetrySamples } from '../../../services/dashboardService'
import { telemetryTimestamp } from '../../../utils/telemetrySeries'
import {
    deriveLineState,
    estimateLineActualUph,
    estimateLineTargetUph,
    findThreshold,
    formatRelativeTime,
    formatWorkOrderStatus,
    initialsFromName,
    lineCode,
    machineCode,
    parseIncidentFact,
    shortHallPillName,
    shortMachineLabel,
    statusColorToken,
} from './operationsHelpers'
import type { DockLayoutVariant } from './OperationsLabFab'

export type OperationsDockTab = 'alerts' | 'inspector' | 'tickets'

interface OperationsSidebarDockProps {
    machine: DashboardMachine | null
    allMachines: DashboardMachine[]
    productionLines: DashboardProductionLine[]
    thresholds: DashboardThreshold[]
    selectedLineId: string | null
    incidents: DashboardIncident[]
    workOrders: DashboardWorkOrder[]
    activeTab: OperationsDockTab
    now: number
    variant: DockLayoutVariant
    connectionStatus: string
    canManageMachines: boolean
    busyAction: string | null
    onClose?: () => void
    onTabChange: (tab: OperationsDockTab) => void
    onSelectMachine: (machineId: string) => void
    onDispatchTech: (machine: DashboardMachine) => void
    onRecoverUnit: (machine: DashboardMachine) => void
    onSetMaintenance: (machine: DashboardMachine) => void
    onRecoverLine: (lineId: string) => void
    onAcknowledgeIncident: (incidentId: string) => void
    onResolveIncident: (incidentId: string) => void
    onAdvanceWorkOrder: (workOrder: DashboardWorkOrder) => void
}

interface TelemetryChannelProps {
    label: string
    unit: string
    current: number | null
    values: number[]
    warn: number | null
    crit: number | null
    color: string
    precision: number
}

function TelemetryChannel({
    label,
    unit,
    current,
    values,
    warn,
    crit,
    color,
    precision,
}: TelemetryChannelProps) {
    const plotValues = values.length >= 2 ? values : current !== null ? [current, current] : []
    const numericBounds = [...plotValues]
    if (warn !== null) numericBounds.push(warn)
    if (crit !== null) numericBounds.push(crit * 1.08)

    const minVal = numericBounds.length ? Math.min(...numericBounds, 0) * 0.85 : 0
    const maxVal = numericBounds.length ? Math.max(...numericBounds, 1) * 1.05 : 10
    const span = Math.max(maxVal - minVal, 1)

    const w = 260
    const h = 44
    const yFor = (v: number) => h - ((v - minVal) / span) * (h - 8) - 4

    const coords = plotValues.map((v, idx) => ({
        x: plotValues.length > 1 ? (idx / (plotValues.length - 1)) * w : w,
        y: yFor(v),
    }))
    const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    const areaD = coords.length ? `${lineD} L${w},${h} L0,${h} Z` : ''
    const last = coords[coords.length - 1] ?? null

    const isCrit = current !== null && crit !== null && current >= crit
    const isWarn = !isCrit && current !== null && warn !== null && current >= warn
    const pctToCrit = current !== null && crit !== null && crit > 0 ? Math.min(140, Math.round((current / crit) * 100)) : null
    const activeStroke = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : color
    const gradId = `sf-ops-ch-${label.toLowerCase().replace(/[^a-z]/g, '')}`

    return (
        <div
            className="rounded-xl border p-3 space-y-2"
            style={{
                background: 'var(--sf-surface-2)',
                borderColor: isCrit ? 'var(--sf-error)' : isWarn ? 'var(--sf-warning)' : 'var(--sf-border)',
            }}
        >
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                    {label}
                </span>
                <div className="flex items-baseline gap-1">
                    <span
                        className="sf-ops-num text-base font-bold"
                        style={{ color: isCrit ? 'var(--sf-error)' : isWarn ? 'var(--sf-warning)' : 'var(--sf-text)' }}
                    >
                        {current === null ? '—' : current.toFixed(precision)}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--sf-muted)' }}>
                        {unit}
                    </span>
                </div>
            </div>

            <div className="h-[44px] w-full">
                {coords.length > 0 ? (
                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activeStroke} stopOpacity="0.28" />
                                <stop offset="100%" stopColor={activeStroke} stopOpacity="0.01" />
                            </linearGradient>
                        </defs>
                        {warn !== null && (
                            <line
                                x1="0"
                                x2={w}
                                y1={yFor(warn)}
                                y2={yFor(warn)}
                                stroke="#f59e0b"
                                strokeOpacity="0.55"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                            />
                        )}
                        {crit !== null && (
                            <line
                                x1="0"
                                x2={w}
                                y1={yFor(crit)}
                                y2={yFor(crit)}
                                stroke="#ef4444"
                                strokeOpacity="0.7"
                                strokeDasharray="3 3"
                                strokeWidth="1.1"
                            />
                        )}
                        <path d={areaD} fill={`url(#${gradId})`} />
                        <path d={lineD} fill="none" stroke={activeStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {last && (
                            <circle cx={last.x} cy={last.y} r="3.2" fill={activeStroke} stroke="var(--sf-surface)" strokeWidth="1.8" />
                        )}
                    </svg>
                ) : (
                    <div className="h-full flex items-center text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                        No samples yet
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-[10px] sf-ops-num" style={{ color: 'var(--sf-muted)' }}>
                <span>
                    {warn !== null || crit !== null
                        ? `Warn ${warn ?? '—'} · Crit ${crit ?? '—'} ${unit}`
                        : 'No threshold configured'}
                </span>
                {pctToCrit !== null && (
                    <span
                        className="font-bold"
                        style={{ color: isCrit ? 'var(--sf-error)' : isWarn ? 'var(--sf-warning)' : 'var(--sf-running)' }}
                    >
                        {pctToCrit}% of crit
                    </span>
                )}
            </div>
        </div>
    )
}

export default function OperationsSidebarDock({
    machine,
    allMachines,
    productionLines,
    thresholds,
    selectedLineId,
    incidents,
    workOrders,
    activeTab,
    now,
    variant,
    connectionStatus,
    canManageMachines,
    busyAction,
    onClose,
    onTabChange,
    onSelectMachine,
    onDispatchTech,
    onRecoverUnit,
    onSetMaintenance,
    onRecoverLine,
    onAcknowledgeIncident,
    onResolveIncident,
    onAdvanceWorkOrder,
}: OperationsSidebarDockProps) {
    const [samplesByMachine, setSamplesByMachine] = useState<{
        machineId: string
        samples: TelemetryReadDto[]
    } | null>(null)

    const inspectedLine =
        selectedLineId && selectedLineId !== 'utilities'
            ? productionLines.find(l => l.id === selectedLineId) ?? null
            : null
    const isUtilitiesMode = selectedLineId === 'utilities'
    const isLineInspector = Boolean(inspectedLine || isUtilitiesMode)
    const activeMachineId = !isLineInspector ? machine?.id ?? null : null

    // Fetch real recent telemetry samples whenever user inspects a machine
    useEffect(() => {
        if (!activeMachineId || activeTab !== 'inspector') return
        const controller = new AbortController()
        void fetchMachineTelemetrySamples(activeMachineId, controller.signal)
            .then(samples => {
                if (!controller.signal.aborted) {
                    setSamplesByMachine({ machineId: activeMachineId, samples: samples.slice(-30) })
                }
            })
            .catch(() => {
                // Keep live-appended points gracefully if history endpoint is temporarily unavailable
            })
        return () => controller.abort()
    }, [activeMachineId, activeTab])

    // Append incoming live telemetry ticks from SignalR to the machine's rolling oscilloscope series
    const liveReading = machine?.latestTelemetry ?? null
    const liveTimestamp = liveReading?.timestampUtc ?? null
    useEffect(() => {
        if (!activeMachineId || !liveReading || !liveTimestamp) return
        setSamplesByMachine(current => {
            const existing = current?.machineId === activeMachineId ? current.samples : []
            const incomingTs = telemetryTimestamp(liveTimestamp)
            const lastTs = existing.length ? telemetryTimestamp(existing[existing.length - 1].timestamp) : 0
            if (!Number.isFinite(incomingTs) || incomingTs <= lastTs) {
                return current
            }
            const nextSample: TelemetryReadDto = {
                id: `${activeMachineId}-${incomingTs}`,
                machineId: activeMachineId,
                timestamp: liveTimestamp,
                temperature: liveReading.temperature,
                vibration: liveReading.vibration,
                powerLoadKw: liveReading.powerLoadKw,
                networkLatencyMs: liveReading.networkLatencyMs,
            }
            return {
                machineId: activeMachineId,
                samples: [...existing, nextSample].slice(-30),
            }
        })
    }, [activeMachineId, liveReading, liveTimestamp])

    const activeIncidentCount = incidents.filter(i => i.status === 'Active').length
    const openOrdersCount = workOrders.filter(w => w.status !== 'Resolved').length
    const isLive = connectionStatus === 'Live'
    const isSidebar = variant === 'sidebar'
    const isBusy = busyAction !== null

    const machineSamples =
        activeMachineId && samplesByMachine?.machineId === activeMachineId ? samplesByMachine.samples : []
    const tempSeries = machineSamples.map(s => s.temperature).filter((v): v is number => v !== null)
    const vibSeries = machineSamples.map(s => s.vibration).filter((v): v is number => v !== null)
    const powerSeries = machineSamples.map(s => s.powerLoadKw).filter((v): v is number => v !== null)

    const tempThresh = machine ? findThreshold(thresholds, machine.id, 'Temperature') : { warn: null, crit: null }
    const vibThresh = machine ? findThreshold(thresholds, machine.id, 'Vibration') : { warn: null, crit: null }
    const powerThresh = machine ? findThreshold(thresholds, machine.id, 'PowerLoadKw') : { warn: null, crit: null }

    const statusColorMap = machine
        ? {
              Running: { fg: 'var(--sf-running)', bg: 'var(--sf-running-bg)' },
              Warning: { fg: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' },
              Error: { fg: 'var(--sf-error)', bg: 'var(--sf-error-bg)' },
              Maintenance: { fg: 'var(--sf-maint)', bg: 'var(--sf-maint-bg)' },
              Offline: { fg: 'var(--sf-offline)', bg: 'var(--sf-offline-bg)' },
          }[machine.status]
        : { fg: 'var(--sf-offline)', bg: 'var(--sf-offline-bg)' }

    // Line-mode Inspector derivations
    const lineStations = isUtilitiesMode
        ? allMachines.filter(m => m.productionLineId === null).sort((a, b) => a.name.localeCompare(b.name))
        : inspectedLine
          ? allMachines
                .filter(m => m.productionLineId === inspectedLine.id)
                .sort((a, b) => a.orderInLine - b.orderInLine || a.name.localeCompare(b.name))
          : []
    const lineStationIds = new Set(lineStations.map(s => s.id))
    const lineWorkOrders = workOrders.filter(w => lineStationIds.has(w.machineId))
    const lineActiveIncidents = incidents.filter(i => lineStationIds.has(i.machineId) && i.status !== 'Resolved')
    const lineState: 'Running' | 'Warning' | 'Halted' = isUtilitiesMode
        ? lineStations.some(s => s.status === 'Error')
            ? 'Halted'
            : lineStations.some(s => s.status === 'Warning' || s.status === 'Maintenance')
              ? 'Warning'
              : 'Running'
        : deriveLineState(inspectedLine, lineStations)
    const lineTone =
        lineState === 'Halted'
            ? { fg: 'var(--sf-error)', bg: 'var(--sf-error-bg)' }
            : lineState === 'Warning'
              ? { fg: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' }
              : { fg: 'var(--sf-running)', bg: 'var(--sf-running-bg)' }
    const linePowerKw = lineStations.reduce((sum, s) => sum + (s.latestTelemetry?.powerLoadKw ?? 0), 0)
    const lineBottleneck =
        lineStations.find(s => s.status === 'Error') ??
        lineStations.find(s => s.status === 'Warning') ??
        lineStations.find(s => s.status === 'Maintenance') ??
        null
    const lineMaxCycle = lineStations.reduce((max, s) => Math.max(max, s.cycleTimeSeconds ?? 0), 0)
    const lineTargetUph = estimateLineTargetUph(lineStations)
    const lineRate = estimateLineActualUph(lineState, lineTargetUph)
    const inspectedLineIndex = inspectedLine ? productionLines.findIndex(l => l.id === inspectedLine.id) : -1

    return (
        <aside
            className={
                isSidebar
                    ? 'flex flex-col h-full border-t xl:border-t-0 xl:border-l overflow-hidden'
                    : 'sf-ops-card flex flex-col overflow-hidden h-full'
            }
            style={isSidebar ? { background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' } : undefined}
            aria-label="Event Stream and Inspector"
        >
            {/* Sidebar-mode Top Bar (exact h-16 alignment with header & left nav) */}
            {isSidebar && (
                <div
                    className="px-5 h-16 border-b flex items-center justify-between gap-2 shrink-0"
                    style={{ borderColor: 'var(--sf-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-xs font-bold uppercase tracking-wider">Event Stream</h2>
                        <span
                            className="relative flex h-2.5 w-2.5 shrink-0"
                            role="status"
                            aria-label={isLive ? 'SignalR live connected' : connectionStatus}
                            title={isLive ? 'SignalR live connected' : connectionStatus}
                        >
                            {isLive && (
                                <span
                                    className="sf-ops-header-ping absolute inline-flex h-full w-full rounded-full"
                                    style={{ background: 'var(--sf-running)' }}
                                />
                            )}
                            <span
                                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? 'sf-ops-header-dot' : ''}`}
                                style={{ background: isLive ? 'var(--sf-running)' : 'var(--sf-warning)' }}
                            />
                        </span>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg border cursor-pointer transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            aria-label="Close inspector drawer"
                            title="Close inspector"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* 3-Tab Header: Alerts | Inspector | Tickets */}
            <div
                className="grid grid-cols-3 p-1.5 border-b gap-1 shrink-0"
                style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-surface-2)' }}
                role="tablist"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'alerts'}
                    onClick={() => onTabChange('alerts')}
                    className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
                    style={
                        activeTab === 'alerts'
                            ? { background: 'var(--sf-surface)', color: 'var(--sf-accent)', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }
                            : { color: 'var(--sf-muted)' }
                    }
                >
                    <Bell className="w-3.5 h-3.5 shrink-0" />
                    <span>Alerts</span>
                    {activeIncidentCount > 0 && (
                        <span className="sf-ops-num text-[9.5px] px-1.5 rounded-full bg-red-500 text-white leading-tight">
                            {activeIncidentCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'inspector'}
                    onClick={() => onTabChange('inspector')}
                    className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
                    style={
                        activeTab === 'inspector'
                            ? { background: 'var(--sf-surface)', color: 'var(--sf-accent)', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }
                            : { color: 'var(--sf-muted)' }
                    }
                >
                    <Cpu className="w-3.5 h-3.5 shrink-0" />
                    <span>Inspector</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'tickets'}
                    onClick={() => onTabChange('tickets')}
                    className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
                    style={
                        activeTab === 'tickets'
                            ? { background: 'var(--sf-surface)', color: 'var(--sf-accent)', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }
                            : { color: 'var(--sf-muted)' }
                    }
                >
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>Tickets</span>
                    <span
                        className="sf-ops-num text-[9.5px] px-1.5 rounded-full leading-tight"
                        style={{ background: 'var(--sf-accent-soft)', color: 'var(--sf-accent)' }}
                    >
                        {openOrdersCount}
                    </span>
                </button>
            </div>

            {/* TAB 1: ALERTS (compact incident cards without verbose text) */}
            {activeTab === 'alerts' && (
                <div className="p-4 space-y-2.5 overflow-y-auto sf-ops-scroll flex-1">
                    {incidents.length === 0 && (
                        <div className="text-center py-10 text-xs" style={{ color: 'var(--sf-muted)' }}>
                            No incidents recorded for this selection.
                        </div>
                    )}
                    {incidents.map(inc => {
                        const sevColor =
                            inc.severity === 'Critical'
                                ? 'var(--sf-error)'
                                : inc.severity === 'Warning'
                                  ? 'var(--sf-warning)'
                                  : 'var(--sf-accent)'
                        const softBg = `color-mix(in srgb, ${sevColor} 5.5%, var(--sf-surface))`
                        const softBorder = `color-mix(in srgb, ${sevColor} 24%, var(--sf-border))`
                        const softAccentEdge = `color-mix(in srgb, ${sevColor} 62%, var(--sf-border))`
                        const isResolved = inc.status === 'Resolved'
                        const fact = parseIncidentFact(inc)

                        return (
                            <article
                                key={inc.id}
                                className="rounded-xl border px-3 py-2.5 transition-all"
                                style={{
                                    background: isResolved ? 'var(--sf-surface-2)' : softBg,
                                    borderColor: isResolved ? 'var(--sf-border)' : softBorder,
                                    borderLeftWidth: '3px',
                                    borderLeftColor: isResolved ? 'var(--sf-border-strong)' : softAccentEdge,
                                    opacity: isResolved ? 0.68 : 1,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2 text-[10px]">
                                    <span className="font-bold uppercase tracking-wider" style={{ color: sevColor }}>
                                        {inc.severity} · {fact.metric}
                                    </span>
                                    <span className="sf-ops-num flex items-center gap-1 shrink-0" style={{ color: 'var(--sf-muted)' }}>
                                        <Clock className="w-3 h-3" />
                                        {formatRelativeTime(inc.triggeredAtUtc, now)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelectMachine(inc.machineId)}
                                    className="mt-1.5 w-full flex items-baseline justify-between gap-2 text-left hover:underline cursor-pointer"
                                >
                                    <span className="font-semibold text-xs truncate">{inc.machineName}</span>
                                    {fact.readingValue && (
                                        <span
                                            className="sf-ops-num text-[11px] font-bold shrink-0 px-1.5 py-0.5 rounded-md"
                                            style={{
                                                background: isResolved
                                                    ? 'var(--sf-surface)'
                                                    : `color-mix(in srgb, ${sevColor} 12%, var(--sf-surface))`,
                                                color: isResolved ? 'var(--sf-muted)' : sevColor,
                                            }}
                                        >
                                            {fact.readingValue}
                                        </span>
                                    )}
                                </button>
                                <div
                                    className="flex items-center justify-between gap-2 mt-2 pt-2 border-t text-[11px]"
                                    style={{ borderColor: 'var(--sf-border)' }}
                                >
                                    <span className="sf-ops-num text-[10px] font-bold uppercase" style={{ color: 'var(--sf-muted)' }}>
                                        {inc.status}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {inc.status === 'Active' && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => onAcknowledgeIncident(inc.id)}
                                                className="px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer disabled:opacity-50"
                                                style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border-strong)' }}
                                            >
                                                Ack
                                            </button>
                                        )}
                                        {inc.status !== 'Resolved' && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => onResolveIncident(inc.id)}
                                                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Check className="w-3 h-3" /> Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            {/* TAB 2A: LINE INSPECTOR */}
            {activeTab === 'inspector' && isLineInspector && (
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto sf-ops-scroll flex-1">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: lineTone.bg, color: lineTone.fg }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: lineTone.fg }} />
                                {isUtilitiesMode && lineState === 'Running' ? 'Nominal' : lineState}
                            </span>
                            <span className="sf-ops-num text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                {inspectedLine
                                    ? `${lineCode(inspectedLine, Math.max(0, inspectedLineIndex))} · ${shortHallPillName(inspectedLine.factoryHallName)}`
                                    : 'Shared Infrastructure'}
                            </span>
                        </div>
                        <h3 className="text-[15px] font-bold leading-snug mt-1.5">
                            {inspectedLine ? inspectedLine.name : 'Plant Utilities'}
                        </h3>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--sf-muted)' }}>
                            {inspectedLine
                                ? [inspectedLine.productName, inspectedLine.productSku].filter(Boolean).join(' · ') || 'No product assigned'
                                : 'Independent stations not assigned to a line'}
                        </p>
                    </div>

                    {/* 3 Clean Line Specs */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                            <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>
                                {inspectedLine ? 'Pace' : 'Online'}
                            </div>
                            <div className="sf-ops-num text-xs font-bold mt-0.5">
                                {inspectedLine
                                    ? lineTargetUph > 0
                                        ? `${lineRate}/${lineTargetUph}`
                                        : '—'
                                    : `${lineStations.filter(s => s.status === 'Running').length}/${lineStations.length}`}
                            </div>
                        </div>
                        <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                            <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Power</div>
                            <div className="sf-ops-num text-xs font-bold mt-0.5">{linePowerKw.toFixed(1)} kW</div>
                        </div>
                        <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                            <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>
                                {inspectedLine ? 'Takt' : 'Tickets'}
                            </div>
                            <div className="sf-ops-num text-xs font-bold mt-0.5">
                                {inspectedLine
                                    ? lineMaxCycle > 0
                                        ? `${lineMaxCycle.toFixed(1)}s`
                                        : '—'
                                    : lineWorkOrders.filter(w => w.status !== 'Resolved').length}
                            </div>
                        </div>
                    </div>

                    {/* Active Alerts on Line */}
                    {lineActiveIncidents.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                Active Line Alerts ({lineActiveIncidents.length})
                            </div>
                            {lineActiveIncidents.map(inc => {
                                const sevCol = inc.severity === 'Critical' ? 'var(--sf-error)' : 'var(--sf-warning)'
                                const fact = parseIncidentFact(inc)
                                return (
                                    <button
                                        key={inc.id}
                                        type="button"
                                        onClick={() => onSelectMachine(inc.machineId)}
                                        className="w-full text-left rounded-xl border px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                        style={{
                                            background: `color-mix(in srgb, ${sevCol} 6%, var(--sf-surface))`,
                                            borderColor: `color-mix(in srgb, ${sevCol} 26%, var(--sf-border))`,
                                            borderLeftWidth: '3px',
                                            borderLeftColor: `color-mix(in srgb, ${sevCol} 65%, var(--sf-border))`,
                                        }}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sevCol }}>
                                                {inc.severity} · {fact.metric}
                                            </div>
                                            <div className="text-xs font-semibold truncate mt-0.5">{inc.machineName}</div>
                                        </div>
                                        {fact.readingValue && (
                                            <span className="sf-ops-num text-[11px] font-bold shrink-0" style={{ color: sevCol }}>
                                                {fact.readingValue}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Line Sequence */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            <span>{inspectedLine ? 'Line Sequence' : 'Utility Units'} ({lineStations.length})</span>
                            <span className="font-normal normal-case">Click to inspect</span>
                        </div>
                        <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-surface-2)' }}>
                            {lineStations.map((st, idx) => {
                                const tel = st.latestTelemetry
                                const stColor = statusColorToken(st.status)
                                return (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => onSelectMachine(st.id)}
                                        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs cursor-pointer transition-colors hover:opacity-85"
                                        style={{ borderColor: 'var(--sf-border)' }}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="sf-ops-num text-[10px] w-4 shrink-0" style={{ color: 'var(--sf-muted)' }}>
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stColor }} />
                                            <span className="sf-ops-num text-[11px] font-bold shrink-0">{machineCode(st)}</span>
                                            <span className="truncate text-[11.5px]" style={{ color: 'var(--sf-text-2)' }}>
                                                {shortMachineLabel(st)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span
                                                className="sf-ops-num text-[11px] font-semibold"
                                                style={{ color: st.status === 'Error' || st.status === 'Warning' ? stColor : 'var(--sf-muted)' }}
                                            >
                                                {st.status === 'Offline' || st.status === 'Maintenance'
                                                    ? st.status
                                                    : tel?.temperature != null
                                                      ? `${tel.temperature.toFixed(0)}°C`
                                                      : '—'}
                                            </span>
                                            <ArrowUpRight className="w-3 h-3 opacity-45" />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Line Work Orders */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            Line Work Orders ({lineWorkOrders.length})
                        </div>
                        {lineWorkOrders.length === 0 ? (
                            <div
                                className="rounded-xl border px-3 py-3 text-[11px] text-center"
                                style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            >
                                No work orders assigned to this line.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lineWorkOrders.map(wo => (
                                    <div
                                        key={wo.id}
                                        className="rounded-xl border px-3 py-2.5 space-y-1.5"
                                        style={{
                                            background: 'var(--sf-surface-2)',
                                            borderColor: 'var(--sf-border)',
                                            opacity: wo.status === 'Resolved' ? 0.62 : 1,
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="sf-ops-num text-[10px] font-bold truncate" style={{ color: 'var(--sf-muted)' }}>
                                                {wo.ticketNumber}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => onAdvanceWorkOrder(wo)}
                                                title="Click to cycle status: Open → In Progress → Resolved"
                                                className="sf-ops-num text-[10px] font-bold px-1.5 py-0.5 rounded-md border cursor-pointer shrink-0 disabled:opacity-50"
                                                style={{
                                                    background: wo.status === 'Resolved' ? 'var(--sf-running-bg)' : 'var(--sf-surface)',
                                                    borderColor: wo.status === 'Resolved' ? 'var(--sf-running)' : 'var(--sf-border-strong)',
                                                    color: wo.status === 'Resolved' ? 'var(--sf-running)' : 'var(--sf-text)',
                                                }}
                                            >
                                                {formatWorkOrderStatus(wo.status)}
                                            </button>
                                        </div>
                                        <div className="text-[11.5px] font-semibold leading-snug">{wo.title}</div>
                                        <div className="text-[10.5px]" style={{ color: 'var(--sf-muted)' }}>
                                            Assignee: <strong style={{ color: 'var(--sf-text-2)' }}>{wo.assigneeName ?? 'Unassigned'}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Line Actions */}
                    {(lineBottleneck || (canManageMachines && lineState !== 'Running' && selectedLineId)) && (
                        <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--sf-border)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                Quick Line Actions
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {lineBottleneck && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectMachine(lineBottleneck.id)}
                                        className={`${!(canManageMachines && lineState !== 'Running') ? 'col-span-2' : ''} flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer`}
                                    >
                                        <Cpu className="w-3.5 h-3.5" />
                                        <span>Inspect {machineCode(lineBottleneck)}</span>
                                    </button>
                                )}
                                {canManageMachines && selectedLineId && lineState !== 'Running' && (
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => onRecoverLine(selectedLineId)}
                                        className={`${!lineBottleneck ? 'col-span-2' : ''} flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50`}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>{busyAction === `line-${selectedLineId}` ? 'Recovering…' : 'Recover Line'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2B: MACHINE INSPECTOR (no icon, left-aligned, real telemetry oscilloscopes) */}
            {activeTab === 'inspector' && !isLineInspector && (
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto sf-ops-scroll flex-1">
                    {!machine ? (
                        <div className="text-center py-10 text-xs" style={{ color: 'var(--sf-muted)' }}>
                            Select a machine or production line to inspect.
                        </div>
                    ) : (
                        <>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                        style={{ background: statusColorMap.bg, color: statusColorMap.fg }}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColorMap.fg }} />
                                        {machine.status}
                                    </span>
                                    {machine.telemetrySource === 'RealDevice' && (
                                        <span
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                            style={{ background: 'var(--sf-running-bg)', color: 'var(--sf-running)' }}
                                            title="Physical IoT / PLC device pushing telemetry via API"
                                        >
                                            <Radio className="w-2.5 h-2.5" />
                                            IoT
                                        </span>
                                    )}
                                    {machine.serialNumber && (
                                        <span className="sf-ops-num text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                            {machine.serialNumber}
                                        </span>
                                    )}
                                </div>
                                <Link
                                    to={`/machines/${machine.id}`}
                                    className="mt-1.5 inline-flex items-center gap-1 text-[15px] font-bold leading-snug hover:underline"
                                >
                                    <span>{machine.name}</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 opacity-55 shrink-0" />
                                </Link>
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--sf-muted)' }}>
                                    {machine.productionLineName ?? 'Independent Utility'} · {machine.category}
                                </p>
                            </div>

                            {/* Quick Hardware Spec Strip */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Op. Hours</div>
                                    <div className="sf-ops-num text-xs font-bold mt-0.5">
                                        {machine.totalOperatingHours != null
                                            ? `${Math.round(machine.totalOperatingHours).toLocaleString('en-GB')} h`
                                            : '—'}
                                    </div>
                                </div>
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Produced</div>
                                    <div className="sf-ops-num text-xs font-bold mt-0.5">
                                        {machine.totalProduced > 0 ? machine.totalProduced.toLocaleString('en-GB') : 'Utility'}
                                    </div>
                                </div>
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Latency</div>
                                    <div className="sf-ops-num text-xs font-bold mt-0.5">
                                        {liveReading?.networkLatencyMs != null ? `${liveReading.networkLatencyMs} ms` : '—'}
                                    </div>
                                </div>
                            </div>

                            {/* 3 Live Telemetry Oscilloscopes */}
                            <div className="space-y-2.5">
                                <TelemetryChannel
                                    label="Temperature"
                                    unit="°C"
                                    current={liveReading?.temperature ?? null}
                                    values={tempSeries}
                                    warn={tempThresh.warn}
                                    crit={tempThresh.crit}
                                    color="#0ea5e9"
                                    precision={1}
                                />
                                <TelemetryChannel
                                    label="Vibration RMS"
                                    unit="mm/s"
                                    current={liveReading?.vibration ?? null}
                                    values={vibSeries}
                                    warn={vibThresh.warn}
                                    crit={vibThresh.crit}
                                    color="#8b5cf6"
                                    precision={2}
                                />
                                <TelemetryChannel
                                    label="Power Load"
                                    unit="kW"
                                    current={liveReading?.powerLoadKw ?? null}
                                    values={powerSeries}
                                    warn={powerThresh.warn}
                                    crit={powerThresh.crit}
                                    color="#10b981"
                                    precision={1}
                                />
                            </div>

                            {/* Quick Operator Actions */}
                            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--sf-border)' }}>
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                    Quick Operator Actions
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {(machine.status === 'Error' || machine.status === 'Warning') && (
                                        <>
                                            <div className={`relative group ${!canManageMachines ? 'col-span-2' : ''}`}>
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => onDispatchTech(machine)}
                                                    title="Creates a service work order and assigns the hall technician to this machine"
                                                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    <span>{busyAction === `dispatch-${machine.id}` ? 'Sending…' : 'Dispatch Tech'}</span>
                                                </button>
                                                <span
                                                    role="tooltip"
                                                    className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 w-52 px-2.5 py-2 rounded-lg text-[11px] font-medium leading-snug text-white bg-slate-900 border border-slate-700 shadow-xl z-30"
                                                >
                                                    Creates a service work order and assigns the hall technician to this machine.
                                                </span>
                                            </div>
                                            {canManageMachines && machine.telemetrySource !== 'RealDevice' && (
                                                <div className="relative group">
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => onRecoverUnit(machine)}
                                                        title="Completes repair, clears active fault, and resumes normal operation"
                                                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        <span>{busyAction === `recover-${machine.id}` ? 'Repairing…' : 'Recover Unit'}</span>
                                                    </button>
                                                    <span
                                                        role="tooltip"
                                                        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-52 px-2.5 py-2 rounded-lg text-[11px] font-medium leading-snug text-white bg-slate-900 border border-slate-700 shadow-xl z-30"
                                                    >
                                                        Completes repair, clears active fault, and resumes normal machine operation.
                                                    </span>
                                                </div>
                                            )}
                                            {canManageMachines && machine.telemetrySource === 'RealDevice' && (
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => onSetMaintenance(machine)}
                                                    title="Places this IoT device in planned maintenance and suppresses fault alerts"
                                                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    <Wrench className="w-3.5 h-3.5" />
                                                    <span>{busyAction === `maint-${machine.id}` ? 'Updating…' : 'Maintenance'}</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {machine.status === 'Running' && canManageMachines && (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => onSetMaintenance(machine)}
                                            className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <Wrench className="w-4 h-4" />
                                            <span>{busyAction === `maint-${machine.id}` ? 'Updating…' : 'Set Maintenance'}</span>
                                        </button>
                                    )}
                                    {machine.status === 'Running' && !canManageMachines && (
                                        <Link
                                            to={`/machines/${machine.id}`}
                                            className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                                        >
                                            <span>Open Machine Details</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                    {(machine.status === 'Maintenance' || machine.status === 'Offline') &&
                                        canManageMachines &&
                                        (machine.telemetrySource === 'RealDevice' ? (
                                            machine.status === 'Maintenance' ? (
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => onRecoverUnit(machine)}
                                                    className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    <span>
                                                        {busyAction === `recover-${machine.id}` ? 'Completing…' : 'Complete Repair'}
                                                    </span>
                                                </button>
                                            ) : (
                                                <div
                                                    className="col-span-2 rounded-lg border px-3 py-2 text-[11px] font-medium flex items-center justify-center gap-1.5"
                                                    style={{
                                                        background: 'var(--sf-surface-2)',
                                                        borderColor: 'var(--sf-border)',
                                                        color: 'var(--sf-muted)',
                                                    }}
                                                >
                                                    <Radio className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Waiting for live device telemetry…</span>
                                                </div>
                                            )
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => onRecoverUnit(machine)}
                                                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Play className="w-4 h-4" />
                                                <span>
                                                    {busyAction === `recover-${machine.id}` ? 'Starting…' : 'Bring Station Online'}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB 3: WORK ORDERS / TICKETS */}
            {activeTab === 'tickets' && (
                <div className="p-4 space-y-2.5 overflow-y-auto sf-ops-scroll flex-1">
                    {workOrders.length === 0 && (
                        <div className="text-center py-10 text-xs" style={{ color: 'var(--sf-muted)' }}>
                            No work orders recorded for this selection.
                        </div>
                    )}
                    {workOrders.map(wo => {
                        const prioColor =
                            wo.type === 'Critical'
                                ? 'var(--sf-error)'
                                : wo.type === 'Predictive'
                                  ? 'var(--sf-warning)'
                                  : 'var(--sf-accent)'
                        const prioBg =
                            wo.type === 'Critical'
                                ? 'var(--sf-error-bg)'
                                : wo.type === 'Predictive'
                                  ? 'var(--sf-warning-bg)'
                                  : 'var(--sf-accent-soft)'

                        return (
                            <article
                                key={wo.id}
                                className="rounded-xl border p-3.5 space-y-2"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border)',
                                    opacity: wo.status === 'Resolved' ? 0.62 : 1,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="sf-ops-num text-[10px] font-bold truncate" style={{ color: 'var(--sf-muted)' }}>
                                        {wo.ticketNumber}
                                    </span>
                                    <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                        style={{ background: prioBg, color: prioColor }}
                                    >
                                        {wo.type}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelectMachine(wo.machineId)}
                                    className="text-left text-xs font-bold leading-snug hover:underline cursor-pointer block"
                                >
                                    {wo.title}
                                </button>
                                <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--sf-border)' }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0"
                                            style={{ background: 'var(--sf-accent-soft)', color: 'var(--sf-accent)' }}
                                        >
                                            {initialsFromName(wo.assigneeName)}
                                        </span>
                                        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--sf-text-2)' }}>
                                            {wo.assigneeName ?? 'Unassigned'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => onAdvanceWorkOrder(wo)}
                                        className="sf-ops-num text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                                        style={{
                                            background: wo.status === 'Resolved' ? 'var(--sf-running-bg)' : 'var(--sf-surface)',
                                            borderColor: wo.status === 'Resolved' ? 'var(--sf-running)' : 'var(--sf-border-strong)',
                                            color: wo.status === 'Resolved' ? 'var(--sf-running)' : 'var(--sf-text)',
                                        }}
                                        title="Click to cycle status: Open → In Progress → Resolved"
                                    >
                                        {formatWorkOrderStatus(wo.status)}
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </aside>
    )
}
