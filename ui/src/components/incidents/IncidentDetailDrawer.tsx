import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    AlertTriangle,
    ArrowUpRight,
    Check,
    CheckCircle2,
    Clock,
    Cpu,
    RotateCcw,
    Send,
    Wrench,
    X,
} from 'lucide-react'
import type { IncidentHistoryItem, IncidentStatus } from '../../types/incident'
import {
    formatRelativeTime,
    shortHallPillName,
    statusColorToken,
} from '../live_dashboard/operations/operationsHelpers'
import { telemetryTimestamp } from '../../utils/telemetrySeries'

export interface ParsedIncidentDisplay {
    headline: string
    category: string
    readingPill: string | null
    sourceTag: 'Simulation' | 'IoT' | null
    readings: { label: string; value: string }[]
}

/**
 * Strips redundant machine-name prefixes and raw metric dumps so table rows stay concise
 * while the full raw message remains available inside the detail drawer.
 */
export function parseIncidentDisplay(item: IncidentHistoryItem): ParsedIncidentDisplay {
    const raw = (item.message ?? '').trim()
    let sourceTag: 'Simulation' | 'IoT' | null = null
    let body = raw

    if (/^Simulation:\s*/i.test(body)) {
        sourceTag = 'Simulation'
        body = body.replace(/^Simulation:\s*/i, '')
    } else if (/^Telemetry:\s*/i.test(body)) {
        sourceTag = 'IoT'
        body = body.replace(/^Telemetry:\s*/i, '')
    }

    // Strip leading "<MachineName>: " so the machine name isn't duplicated in the Event column
    if (item.machineName && body.toLowerCase().startsWith(item.machineName.toLowerCase())) {
        body = body.slice(item.machineName.length).replace(/^\s*[:\-–]\s*/, '')
    }

    const readings: { label: string; value: string }[] = []
    const tempMatch = raw.match(/T=([0-9]+(?:\.[0-9]+)?)\s*°?C/i)
    const vibMatch = raw.match(/V=([0-9]+(?:\.[0-9]+)?)\s*mm\/s/i)
    const powerMatch = raw.match(/P=([0-9]+(?:\.[0-9]+)?)\s*kW/i)
    if (tempMatch) readings.push({ label: 'Temp', value: `${Number(tempMatch[1]).toFixed(1)} °C` })
    if (vibMatch) readings.push({ label: 'Vib', value: `${Number(vibMatch[1]).toFixed(2)} mm/s` })
    if (powerMatch) readings.push({ label: 'Power', value: `${Number(powerMatch[1]).toFixed(1)} kW` })

    // Remove trailing "; T=..., V=..., P=..." telemetry dump from the short headline
    const withoutMetrics = body.split(/;\s*(?=[TVP]=)/)[0].trim()

    let category = 'System'
    let readingPill: string | null = readings[0]?.value ?? null
    if (/overheat|temp/i.test(raw)) {
        category = 'Thermal'
        if (tempMatch) readingPill = `${Number(tempMatch[1]).toFixed(1)} °C`
    } else if (/vibrat|spindle|bearing/i.test(raw)) {
        category = 'Vibration'
        if (vibMatch) readingPill = `${Number(vibMatch[1]).toFixed(2)} mm/s`
    } else if (/power|overload|servo|current/i.test(raw)) {
        category = 'Electrical'
        if (powerMatch) readingPill = `${Number(powerMatch[1]).toFixed(1)} kW`
    } else if (/e-stop|emergency|safety|curtain/i.test(raw)) {
        category = 'Safety'
    } else if (/hydraulic|coolant|pressure/i.test(raw)) {
        category = 'Fluid'
    } else if (/latency|network|packet/i.test(raw)) {
        category = 'Network'
    } else if (/jam|feed|sensor|calibration/i.test(raw)) {
        category = 'Process'
    }

    // Humanize simulation/telemetry state codes like "Error (Overheating)" -> "Critical overheating fault"
    let headline = withoutMetrics || raw || 'Machine incident recorded'
    const faultCodeMatch = headline.match(/^(Error|Warning)\s*\(([^)]+)\)$/i)
    if (faultCodeMatch) {
        const level = faultCodeMatch[1].toLowerCase() === 'error' ? 'Critical' : 'Warning'
        const mode = faultCodeMatch[2]
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .replace(/\bgeneric\b/i, 'threshold breach')
        headline = `${level}: ${mode}`
    }

    return { headline, category, readingPill, sourceTag, readings }
}

interface IncidentDetailDrawerProps {
    incident: IncidentHistoryItem | null
    now: number
    busyAction: string | null
    onClose: () => void
    onUpdateStatus: (incident: IncidentHistoryItem, nextStatus: IncidentStatus) => void
    onDispatchTech: (incident: IncidentHistoryItem) => void
}

export default function IncidentDetailDrawer({
    incident,
    now,
    busyAction,
    onClose,
    onUpdateStatus,
    onDispatchTech,
}: IncidentDetailDrawerProps) {
    useEffect(() => {
        if (!incident) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [incident, onClose])

    if (!incident) return null

    const parsed = parseIncidentDisplay(incident)
    const isCritical = incident.severity === 'Critical'
    const sevTone = isCritical
        ? { fg: 'var(--sf-error)', bg: 'var(--sf-error-bg)' }
        : { fg: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' }
    const statusTone =
        incident.status === 'Resolved'
            ? { fg: 'var(--sf-running)', bg: 'var(--sf-running-bg)' }
            : incident.status === 'Acknowledged'
              ? { fg: 'var(--sf-accent)', bg: 'var(--sf-accent-soft)' }
              : { fg: sevTone.fg, bg: sevTone.bg }
    const machineStatusColor = statusColorToken(incident.machineStatus)
    const exactTime = new Date(telemetryTimestamp(incident.triggeredAtUtc)).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })
    const isBusy = busyAction !== null

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
                onClick={onClose}
            />
            <aside
                className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] shadow-2xl border-l flex flex-col overflow-hidden"
                style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}
                aria-label="Incident details"
            >
                {/* Header */}
                <div
                    className="px-5 h-16 border-b flex items-center justify-between gap-2 shrink-0"
                    style={{ borderColor: 'var(--sf-border)' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: sevTone.fg }} />
                        <h2 className="text-xs font-bold uppercase tracking-wider truncate">
                            Incident Detail
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border cursor-pointer transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                        aria-label="Close incident detail"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5 overflow-y-auto sf-ops-scroll flex-1">
                    {/* Badges & Headline */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: sevTone.bg, color: sevTone.fg }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevTone.fg }} />
                                {incident.severity}
                            </span>
                            <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: statusTone.bg, color: statusTone.fg }}
                            >
                                {incident.status}
                            </span>
                            <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border)',
                                    color: 'var(--sf-muted)',
                                }}
                            >
                                {parsed.category}
                            </span>
                            {parsed.sourceTag && (
                                <span
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                                    style={{
                                        background: 'var(--sf-surface-2)',
                                        borderColor: 'var(--sf-border)',
                                        color: 'var(--sf-muted)',
                                    }}
                                >
                                    {parsed.sourceTag}
                                </span>
                            )}
                        </div>

                        <h3 className="text-[15px] font-bold leading-snug">{parsed.headline}</h3>

                        <div className="flex items-center gap-1.5 text-xs sf-ops-num" style={{ color: 'var(--sf-muted)' }}>
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{exactTime}</span>
                            <span>·</span>
                            <span>{formatRelativeTime(incident.triggeredAtUtc, now)}</span>
                        </div>
                    </div>

                    {/* Captured Sensor Snapshot (only when telemetry readings exist in event) */}
                    {parsed.readings.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                Snapshot at Trigger
                            </div>
                            <div className={`grid gap-2 ${parsed.readings.length === 1 ? 'grid-cols-1' : parsed.readings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {parsed.readings.map(r => (
                                    <div
                                        key={r.label}
                                        className="rounded-xl px-3 py-2 border"
                                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                    >
                                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--sf-muted)' }}>
                                            {r.label}
                                        </div>
                                        <div className="sf-ops-num text-xs font-bold mt-0.5">{r.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Full Event Log Entry */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            Raw Event Log
                        </div>
                        <div
                            className="rounded-xl border p-3 text-xs leading-relaxed break-words"
                            style={{
                                background: 'var(--sf-surface-2)',
                                borderColor: 'var(--sf-border)',
                                color: 'var(--sf-text-2)',
                            }}
                        >
                            {incident.message}
                        </div>
                    </div>

                    {/* Affected Machine Card */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            Affected Asset
                        </div>
                        <div
                            className="rounded-xl border p-3.5 space-y-3"
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Cpu className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                                        <span className="text-xs font-bold truncate">{incident.machineName}</span>
                                    </div>
                                    <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--sf-muted)' }}>
                                        {incident.productionLineName ?? 'Standalone Utility'} · {shortHallPillName(incident.factoryHallName)}
                                    </div>
                                </div>
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                    style={{
                                        background: `color-mix(in srgb, ${machineStatusColor} 14%, transparent)`,
                                        color: machineStatusColor,
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: machineStatusColor }} />
                                    {incident.machineStatus}
                                </span>
                            </div>

                            <div
                                className="flex items-center justify-between pt-2.5 border-t text-[11px]"
                                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            >
                                <span className="sf-ops-num">
                                    {incident.machineSerialNumber ? `SN: ${incident.machineSerialNumber}` : incident.machineCategory}
                                    {incident.openWorkOrdersCount > 0 && ` · ${incident.openWorkOrdersCount} open WO`}
                                </span>
                                <Link
                                    to={`/machines/${incident.machineId}`}
                                    className="inline-flex items-center gap-1 font-bold hover:underline"
                                    style={{ color: 'var(--sf-accent)' }}
                                >
                                    <span>Machine Details</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Action Footer */}
                <div
                    className="p-4 border-t space-y-2 shrink-0"
                    style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-surface)' }}
                >
                    <div className="grid grid-cols-2 gap-2">
                        {incident.status === 'Active' && (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onUpdateStatus(incident, 'Acknowledged')}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-colors disabled:opacity-50"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border-strong)',
                                    color: 'var(--sf-text)',
                                }}
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>{busyAction === `status-${incident.id}` ? 'Updating…' : 'Acknowledge'}</span>
                            </button>
                        )}
                        {incident.status !== 'Resolved' ? (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onUpdateStatus(incident, 'Resolved')}
                                className={`${incident.status === 'Acknowledged' ? 'col-span-2' : ''} flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition-colors disabled:opacity-50`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{busyAction === `status-${incident.id}` ? 'Saving…' : 'Mark Resolved'}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onUpdateStatus(incident, 'Active')}
                                className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-colors disabled:opacity-50"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border-strong)',
                                    color: 'var(--sf-text)',
                                }}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{busyAction === `status-${incident.id}` ? 'Reopening…' : 'Reopen Incident'}</span>
                            </button>
                        )}
                    </div>

                    {incident.status !== 'Resolved' && (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDispatchTech(incident)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50"
                        >
                            {busyAction === `dispatch-${incident.id}` ? (
                                <Wrench className="w-3.5 h-3.5 animate-pulse" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            <span>
                                {busyAction === `dispatch-${incident.id}` ? 'Dispatching…' : 'Dispatch Technician'}
                            </span>
                        </button>
                    )}
                </div>
            </aside>
        </>
    )
}
