import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardMachine } from '../../../types/dashboard'
import type { MachineStatus } from '../../../types/machine'
import { machineCode, shortMachineLabel } from './operationsHelpers'

interface OperationsHeatmapProps {
    machines: DashboardMachine[]
    selectedMachineId: string | null
    statusFilter: MachineStatus | 'All'
    onSelectMachine: (machineId: string) => void
}

const TILE_STYLE: Record<MachineStatus, { symbol: string; bg: string; fg: string; border: string }> = {
    Running: { symbol: '✓', bg: '#22c55e', fg: '#064e3b', border: 'rgba(22, 163, 74, 0.35)' },
    Warning: { symbol: '!', bg: '#facc15', fg: '#713f12', border: 'rgba(202, 138, 4, 0.45)' },
    Error: { symbol: '×', bg: '#f87171', fg: '#7f1d1d', border: 'rgba(220, 38, 38, 0.55)' },
    Maintenance: { symbol: '◇', bg: '#c4b5fd', fg: '#4c1d95', border: 'rgba(124, 58, 237, 0.4)' },
    Offline: { symbol: '−', bg: '#cbd5e1', fg: '#334155', border: 'rgba(100, 116, 139, 0.35)' },
}

export default function OperationsHeatmap({
    machines,
    selectedMachineId,
    statusFilter,
    onSelectMachine,
}: OperationsHeatmapProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const hovered = machines.find(m => m.id === hoveredId) ?? null
    const hoveredTel = hovered?.latestTelemetry ?? null

    return (
        <section className="sf-ops-card px-5 py-4" aria-label="Live plant heatmap">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-[14px] font-bold tracking-tight">Live Plant Heatmap</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sf-muted)' }}>
                        Real-time status of individual machines · Select any tile to inspect
                    </p>
                </div>

                {hovered ? (
                    <div
                        className="sf-ops-num text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-2"
                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border-strong)' }}
                    >
                        <span className="font-bold">{machineCode(hovered)}</span>
                        <span style={{ color: 'var(--sf-muted)' }}>·</span>
                        <span className="truncate max-w-[160px]">{shortMachineLabel(hovered)}</span>
                        {hoveredTel?.temperature !== null && hoveredTel?.temperature !== undefined && (
                            <>
                                <span style={{ color: 'var(--sf-muted)' }}>·</span>
                                <span>{hoveredTel.temperature.toFixed(1)}°C</span>
                            </>
                        )}
                        {hoveredTel?.vibration !== null && hoveredTel?.vibration !== undefined && (
                            <span>{hoveredTel.vibration.toFixed(2)} mm/s</span>
                        )}
                    </div>
                ) : (
                    <Link
                        to="/machines"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-100"
                        style={{
                            background: 'var(--sf-surface-2)',
                            borderColor: 'var(--sf-border)',
                            color: 'var(--sf-accent)',
                        }}
                    >
                        <span>Details</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
                {machines.map(machine => {
                    const st = TILE_STYLE[machine.status]
                    const tel = machine.latestTelemetry
                    const selected = machine.id === selectedMachineId
                    const dimmed = statusFilter !== 'All' && machine.status !== statusFilter
                    const titleParts = [
                        machine.name,
                        machine.status,
                        tel?.temperature != null ? `${tel.temperature.toFixed(1)}°C` : null,
                        tel?.vibration != null ? `${tel.vibration.toFixed(2)} mm/s` : null,
                    ].filter(Boolean)

                    return (
                        <button
                            key={machine.id}
                            type="button"
                            onClick={() => onSelectMachine(machine.id)}
                            onMouseEnter={() => setHoveredId(machine.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            aria-pressed={selected}
                            aria-label={`${machine.name}, ${machine.status}`}
                            title={titleParts.join(' · ')}
                            className="relative w-7 h-7 rounded-[6px] grid place-items-center text-[11px] font-extrabold cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                            style={{
                                background: st.bg,
                                color: st.fg,
                                border: `1px solid ${st.border}`,
                                opacity: dimmed ? 0.28 : 1,
                                boxShadow: selected
                                    ? '0 0 0 1.5px var(--sf-surface), 0 0 0 3px color-mix(in srgb, var(--sf-accent) 52%, transparent)'
                                    : undefined,
                            }}
                        >
                            <span className="leading-none">{st.symbol}</span>
                        </button>
                    )
                })}
                {machines.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--sf-muted)' }}>
                        No machines in this selection.
                    </span>
                )}
            </div>
        </section>
    )
}
