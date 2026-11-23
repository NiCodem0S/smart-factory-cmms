import { useState } from 'react'
import { ArrowUpRight, Factory, Search, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardMachine, DashboardProductionLine } from '../../../types/dashboard'
import type { MachineStatus } from '../../../types/machine'
import {
    deriveLineState,
    estimateLineActualUph,
    estimateLineTargetUph,
    formatDurationSince,
    isFreshTelemetry,
    lineCode,
    machineCode,
    shortHallPillName,
    shortMachineLabel,
    statusColorToken,
} from './operationsHelpers'

interface OperationsProductionLinesProps {
    lines: DashboardProductionLine[]
    machines: DashboardMachine[]
    now: number
    selectedMachineId: string | null
    selectedLineId: string | null
    statusFilter: MachineStatus | 'All'
    onSelectMachine: (machineId: string) => void
    onSelectLine: (lineId: string) => void
}

function lineTone(state: 'Running' | 'Warning' | 'Halted') {
    if (state === 'Halted') return { fg: 'var(--sf-error)', bg: 'var(--sf-error-bg)' }
    if (state === 'Warning') return { fg: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' }
    return { fg: 'var(--sf-running)', bg: 'var(--sf-running-bg)' }
}

const STATE_PRIORITY: Record<'Halted' | 'Warning' | 'Running', number> = {
    Halted: 0,
    Warning: 1,
    Running: 2,
}

export default function OperationsProductionLines({
    lines,
    machines,
    now,
    selectedMachineId,
    selectedLineId,
    statusFilter,
    onSelectMachine,
    onSelectLine,
}: OperationsProductionLinesProps) {
    const [search, setSearch] = useState('')
    const query = search.trim().toLowerCase()

    const lineCards = lines
        .map((line, idx) => {
            const stations = machines
                .filter(m => m.productionLineId === line.id)
                .sort((a, b) => a.orderInLine - b.orderInLine || a.name.localeCompare(b.name))
            const state = deriveLineState(line, stations)
            const runningCount = stations.filter(s => s.status === 'Running').length
            const freshPowerStations = stations.filter(
                s => isFreshTelemetry(s, now) && s.latestTelemetry?.powerLoadKw != null,
            )
            const powerKw = freshPowerStations.length
                ? freshPowerStations.reduce((sum, s) => sum + (s.latestTelemetry?.powerLoadKw ?? 0), 0)
                : null
            const completedUnits = stations.length > 0 ? stations[stations.length - 1].totalProduced : 0
            const targetUph = estimateLineTargetUph(stations)
            const ratePerHour = estimateLineActualUph(state, targetUph)
            const code = lineCode(line, idx)
            const hallShort = shortHallPillName(line.factoryHallName)

            const bottleneck =
                stations.find(s => s.status === 'Error') ??
                stations.find(s => s.status === 'Warning') ??
                stations.find(s => s.status === 'Maintenance') ??
                null

            const hasSelected =
                selectedLineId === line.id ||
                (selectedLineId === null && stations.some(s => s.id === selectedMachineId))
            const matchesStatus =
                statusFilter === 'All' || stations.some(s => s.status === statusFilter)

            return {
                line,
                code,
                hallShort,
                stations,
                state,
                runningCount,
                powerKw,
                completedUnits,
                ratePerHour,
                bottleneck,
                hasSelected,
                matchesStatus,
            }
        })
        .filter(item => {
            if (!item.matchesStatus) return false
            if (!query) return true
            return [
                item.line.name,
                item.code,
                item.line.productName ?? '',
                item.line.factoryHallName,
                item.hallShort,
            ].some(v => v.toLowerCase().includes(query))
        })
        .sort((a, b) => STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state] || a.code.localeCompare(b.code))

    // Shared plant utilities (machines without an assigned production line)
    const utilityMachines = machines.filter(m => m.productionLineId === null)
    const showUtilities =
        utilityMachines.length > 0 &&
        (statusFilter === 'All' || utilityMachines.some(m => m.status === statusFilter)) &&
        (!query ||
            'plant utilities infrastructure'.includes(query) ||
            utilityMachines.some(
                m => m.name.toLowerCase().includes(query) || m.factoryHallName.toLowerCase().includes(query),
            ))

    const utilRunning = utilityMachines.filter(m => m.status === 'Running').length
    const freshUtilPower = utilityMachines.filter(
        m => isFreshTelemetry(m, now) && m.latestTelemetry?.powerLoadKw != null,
    )
    const utilPower = freshUtilPower.length
        ? freshUtilPower.reduce((sum, m) => sum + (m.latestTelemetry?.powerLoadKw ?? 0), 0)
        : null
    const utilIssue =
        utilityMachines.find(m => m.status === 'Error') ??
        utilityMachines.find(m => m.status === 'Warning') ??
        utilityMachines.find(m => m.status === 'Maintenance') ??
        null
    const utilState: 'Running' | 'Warning' | 'Halted' = utilityMachines.some(m => m.status === 'Error')
        ? 'Halted'
        : utilIssue
          ? 'Warning'
          : 'Running'
    const utilSelected =
        selectedLineId === 'utilities' ||
        (selectedLineId === null && utilityMachines.some(m => m.id === selectedMachineId))

    const totalCards = lineCards.length + (showUtilities ? 1 : 0)

    return (
        <section className="space-y-3.5" aria-label="Production lines overview">
            {/* Heading + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-[15px] font-bold tracking-tight">Production Lines</h2>
                    <span className="sf-ops-num text-xs font-semibold" style={{ color: 'var(--sf-muted)' }}>
                        {lineCards.length}
                    </span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <label
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
                        style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}
                    >
                        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                        <input
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search line or hall…"
                            aria-label="Search production lines"
                            className="bg-transparent outline-none w-40 sm:w-48 text-xs"
                            style={{ color: 'var(--sf-text)' }}
                        />
                    </label>
                    <Link
                        to="/production"
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors"
                        style={{
                            background: 'var(--sf-surface)',
                            borderColor: 'var(--sf-border)',
                            color: 'var(--sf-accent)',
                        }}
                    >
                        <span>All Lines</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            {/* Minimalist Production Line Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lineCards.map(item => {
                    const tone = lineTone(item.state)
                    const duration = formatDurationSince(item.line.lastStatusChangedAtUtc, now)
                    const durationLabel = item.state === 'Halted' ? `Halted ${duration}` : duration

                    return (
                        <article
                            key={item.line.id}
                            onClick={() => onSelectLine(item.line.id)}
                            className="sf-ops-card p-4 sm:p-5 flex flex-col justify-between gap-3.5 cursor-pointer hover:-translate-y-0.5 transition-all"
                            style={{
                                borderTopWidth: '4px',
                                borderTopColor: tone.fg,
                                borderColor: item.hasSelected
                                    ? 'color-mix(in srgb, var(--sf-accent) 42%, var(--sf-border))'
                                    : undefined,
                                boxShadow: item.hasSelected
                                    ? '0 0 0 1px color-mix(in srgb, var(--sf-accent) 26%, transparent), 0 8px 20px -14px rgba(37, 99, 235, 0.16)'
                                    : undefined,
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                        <span className="sf-ops-num font-bold" style={{ color: 'var(--sf-text-2)' }}>
                                            {item.code}
                                        </span>
                                        <span>·</span>
                                        <span className="truncate">{item.hallShort}</span>
                                    </div>
                                    <h3 className="text-[14.5px] font-bold leading-snug mt-0.5 truncate">
                                        {item.line.name}
                                    </h3>
                                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--sf-muted)' }}>
                                        {item.line.productName ?? 'No active product'}
                                    </p>
                                </div>

                                <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider shrink-0"
                                    style={{ background: tone.bg, color: tone.fg }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.fg }} />
                                    {item.state}
                                </span>
                            </div>

                            {/* 3 Minimalist Line KPIs */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                        Throughput
                                    </div>
                                    <div className="sf-ops-num text-[14px] font-semibold mt-0.5" style={{ color: item.ratePerHour === 0 ? 'var(--sf-error)' : 'var(--sf-text)' }}>
                                        {item.ratePerHour}
                                        <span className="text-[10px] font-normal opacity-70 ml-0.5">u/h</span>
                                    </div>
                                </div>
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                        Power
                                    </div>
                                    <div className="sf-ops-num text-[14px] font-semibold mt-0.5">
                                        {item.powerKw === null ? '—' : item.powerKw.toFixed(1)}
                                        {item.powerKw !== null && <span className="text-[10px] font-normal opacity-70 ml-0.5">kW</span>}
                                    </div>
                                </div>
                                <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                        Stations
                                    </div>
                                    <div className="sf-ops-num text-[14px] font-semibold mt-0.5">
                                        {item.runningCount}
                                        <span className="text-[11px] font-normal opacity-60"> / {item.stations.length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Segmented Station Health Bar */}
                            <div className="space-y-1.5">
                                {item.stations.length > 0 && (
                                    <div className="flex gap-1 h-2">
                                        {item.stations.map(st => {
                                            const tel = st.latestTelemetry
                                            const isSelected = st.id === selectedMachineId
                                            return (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        onSelectMachine(st.id)
                                                    }}
                                                    title={`${machineCode(st)} · ${shortMachineLabel(st)} · ${st.status}${tel?.temperature != null ? ` (${tel.temperature.toFixed(1)}°C)` : ''}`}
                                                    aria-label={`Inspect ${st.name}, ${st.status}`}
                                                    className="flex-1 rounded-full cursor-pointer transition-transform hover:scale-y-125 focus:outline-none"
                                                    style={{
                                                        background: statusColorToken(st.status),
                                                        opacity: statusFilter !== 'All' && st.status !== statusFilter ? 0.25 : 0.9,
                                                        boxShadow: isSelected
                                                            ? '0 0 0 1.5px var(--sf-surface), 0 0 0 2.5px color-mix(in srgb, var(--sf-accent) 60%, transparent)'
                                                            : undefined,
                                                    }}
                                                />
                                            )
                                        })}
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                    {item.bottleneck ? (
                                        <span className="font-semibold truncate" style={{ color: tone.fg }}>
                                            {item.bottleneck.status === 'Error' ? 'Fault:' : 'Watch:'} {machineCode(item.bottleneck)} ({shortMachineLabel(item.bottleneck)})
                                        </span>
                                    ) : (
                                        <span className="truncate">
                                            All stations nominal · {item.completedUnits.toLocaleString('en-GB')} pcs
                                        </span>
                                    )}
                                    <span className="sf-ops-num text-[10.5px] shrink-0">{durationLabel}</span>
                                </div>
                            </div>
                        </article>
                    )
                })}

                {/* Shared Plant Utilities Card */}
                {showUtilities && (
                    <article
                        onClick={() => onSelectLine('utilities')}
                        className="sf-ops-card p-4 sm:p-5 flex flex-col justify-between gap-3.5 cursor-pointer hover:-translate-y-0.5 transition-all"
                        style={{
                            borderTopWidth: '4px',
                            borderTopColor: lineTone(utilState).fg,
                            borderColor: utilSelected
                                ? 'color-mix(in srgb, var(--sf-accent) 42%, var(--sf-border))'
                                : undefined,
                            boxShadow: utilSelected
                                ? '0 0 0 1px color-mix(in srgb, var(--sf-accent) 26%, transparent), 0 8px 20px -14px rgba(37, 99, 235, 0.16)'
                                : undefined,
                        }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                    <Wrench className="w-3 h-3 shrink-0" />
                                    <span>Shared Infrastructure</span>
                                </div>
                                <h3 className="text-[14.5px] font-bold leading-snug mt-0.5 truncate">
                                    Plant Utilities
                                </h3>
                                <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--sf-muted)' }}>
                                    Independent stations not assigned to a line
                                </p>
                            </div>

                            <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider shrink-0"
                                style={{ background: lineTone(utilState).bg, color: lineTone(utilState).fg }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: lineTone(utilState).fg }} />
                                {utilState === 'Running' ? 'Nominal' : utilState}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                    Online
                                </div>
                                <div className="sf-ops-num text-[14px] font-semibold mt-0.5">
                                    {utilRunning}
                                    <span className="text-[11px] font-normal opacity-60"> / {utilityMachines.length}</span>
                                </div>
                            </div>
                            <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                    Power
                                </div>
                                <div className="sf-ops-num text-[14px] font-semibold mt-0.5">
                                    {utilPower === null ? '—' : utilPower.toFixed(1)}
                                    {utilPower !== null && <span className="text-[10px] font-normal opacity-70 ml-0.5">kW</span>}
                                </div>
                            </div>
                            <div className="rounded-xl px-2.5 py-2 border" style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}>
                                <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                    Service
                                </div>
                                <div className="sf-ops-num text-[14px] font-semibold mt-0.5">
                                    {utilityMachines.filter(m => m.status === 'Maintenance').length}
                                    <span className="text-[10px] font-normal opacity-70 ml-0.5">maint</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex gap-1 h-2">
                                {utilityMachines.map(st => {
                                    const tel = st.latestTelemetry
                                    const isSelected = st.id === selectedMachineId
                                    return (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                onSelectMachine(st.id)
                                            }}
                                            title={`${machineCode(st)} · ${shortMachineLabel(st)} · ${st.status}${tel?.powerLoadKw != null ? ` (${tel.powerLoadKw.toFixed(1)} kW)` : ''}`}
                                            aria-label={`Inspect ${st.name}, ${st.status}`}
                                            className="flex-1 rounded-full cursor-pointer transition-transform hover:scale-y-125 focus:outline-none"
                                            style={{
                                                background: statusColorToken(st.status),
                                                opacity: statusFilter !== 'All' && st.status !== statusFilter ? 0.25 : 0.9,
                                                boxShadow: isSelected
                                                    ? '0 0 0 1.5px var(--sf-surface), 0 0 0 2.5px color-mix(in srgb, var(--sf-accent) 60%, transparent)'
                                                    : undefined,
                                            }}
                                        />
                                    )
                                })}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                {utilIssue ? (
                                    <span className="font-semibold truncate" style={{ color: statusColorToken(utilIssue.status) }}>
                                        {utilIssue.status}: {machineCode(utilIssue)} ({shortMachineLabel(utilIssue)})
                                    </span>
                                ) : (
                                    <span className="truncate">All utility systems nominal</span>
                                )}
                                <span className="sf-ops-num text-[10.5px] shrink-0">24/7 base</span>
                            </div>
                        </div>
                    </article>
                )}
            </div>

            {totalCards === 0 && (
                <div className="sf-ops-card p-8 text-center text-xs flex flex-col items-center gap-2" style={{ color: 'var(--sf-muted)' }}>
                    <Factory className="w-5 h-5 opacity-60" />
                    <span>No production lines match your current filter.</span>
                </div>
            )}
        </section>
    )
}
