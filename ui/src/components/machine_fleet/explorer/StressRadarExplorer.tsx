import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowUpDown,
    ArrowUpRight,
    Check,
    ChevronDown,
    Crosshair,
    Filter,
    LayoutGrid,
    Search,
    Table2,
} from 'lucide-react'
import MachineIcon from '../../common/MachineIcon'
import type { DashboardMachine, DashboardThreshold, DashboardWorkOrder } from '../../../types/dashboard'
import { machineStatuses, type MachineStatus } from '../../../types/machine'
import {
    getMachineStressScore,
    getThermalLoadRatio,
    getVibrationLoadRatio,
    machineCode,
    shortHallPillName,
    statusColorToken,
} from '../../live_dashboard/operations/operationsHelpers'

interface StressRadarExplorerProps {
    scopeKey: string
    machines: DashboardMachine[]
    thresholds: DashboardThreshold[]
    workOrders: DashboardWorkOrder[]
    tempHistoryByMachine: Record<string, number[]>
    selectedMachineId: string | null
    statusFilter: MachineStatus | 'All'
    onStatusFilterChange: (status: MachineStatus | 'All') => void
    onSelectMachine: (machineId: string) => void
}

type ExplorerMode = 'table' | 'grid' | 'radar'
type SortKey = 'stress' | 'name' | 'temp' | 'vib' | 'power' | 'tickets' | 'produced'

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
    const series = values.length >= 2 ? values.slice(-14) : values.length === 1 ? [values[0], values[0]] : []
    if (!series.length) {
        return (
            <span className="w-[106px] h-[30px] shrink-0 flex items-center justify-end text-xs" style={{ color: 'var(--sf-muted)' }}>
                —
            </span>
        )
    }

    const min = Math.min(...series) * 0.94
    const max = Math.max(...series, min + 1) * 1.04
    const span = Math.max(max - min, 1)
    const w = 106
    const h = 30
    const d = series
        .map((v, i, arr) => {
            const x = arr.length > 1 ? (i / (arr.length - 1)) * w : w
            const y = h - ((v - min) / span) * (h - 5) - 2.5
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-[106px] h-[30px] overflow-visible shrink-0">
            <path d={d} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function formatMetric(value: number | null | undefined, digits: number, suffix = ''): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return `${value.toFixed(digits)}${suffix}`
}

export default function StressRadarExplorer({
    scopeKey,
    machines,
    thresholds,
    workOrders,
    tempHistoryByMachine,
    selectedMachineId,
    statusFilter,
    onStatusFilterChange,
    onSelectMachine,
}: StressRadarExplorerProps) {
    const [mode, setMode] = useState<ExplorerMode>('table')
    const [search, setSearch] = useState('')
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    // Static DB order by default — never jumps on live telemetry updates unless user explicitly sorts
    const [sortKey, setSortKey] = useState<SortKey | null>(null)
    const [sortDesc, setSortDesc] = useState(true)
    const [page, setPage] = useState(1)
    const [statusMenuOpen, setStatusMenuOpen] = useState(false)
    const statusDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setPage(1)
    }, [scopeKey])

    useEffect(() => {
        if (!statusMenuOpen) return
        const handleOutside = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
                setStatusMenuOpen(false)
            }
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setStatusMenuOpen(false)
        }
        document.addEventListener('mousedown', handleOutside)
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('mousedown', handleOutside)
            document.removeEventListener('keydown', handleKey)
        }
    }, [statusMenuOpen])

    const statusCounts: Record<string, number> = {
        All: machines.length,
        Running: 0,
        Warning: 0,
        Error: 0,
        Maintenance: 0,
        Offline: 0,
    }
    for (const m of machines) statusCounts[m.status] += 1

    const openOrdersByMachine = new Map<string, number>()
    for (const wo of workOrders) {
        if (wo.status === 'Resolved') continue
        openOrdersByMachine.set(wo.machineId, (openOrdersByMachine.get(wo.machineId) ?? 0) + 1)
    }

    const query = search.trim().toLowerCase()
    const filtered = machines.filter(m => {
        if (statusFilter !== 'All' && m.status !== statusFilter) return false
        if (!query) return true
        return [
            m.name,
            machineCode(m),
            m.serialNumber ?? '',
            m.category,
            m.productionLineName ?? '',
            m.factoryHallName,
        ].some(field => field.toLowerCase().includes(query))
    })

    // Preserve static order when sortKey is null; only reorder when user explicitly selects a sort column
    const ordered =
        sortKey === null
            ? filtered
            : [...filtered].sort((a, b) => {
                  let cmp = 0
                  switch (sortKey) {
                      case 'stress':
                          cmp = getMachineStressScore(a, thresholds) - getMachineStressScore(b, thresholds)
                          break
                      case 'name':
                          cmp = a.name.localeCompare(b.name)
                          break
                      case 'temp':
                          cmp = (a.latestTelemetry?.temperature ?? -Infinity) - (b.latestTelemetry?.temperature ?? -Infinity)
                          break
                      case 'vib':
                          cmp = (a.latestTelemetry?.vibration ?? -Infinity) - (b.latestTelemetry?.vibration ?? -Infinity)
                          break
                      case 'power':
                          cmp = (a.latestTelemetry?.powerLoadKw ?? -Infinity) - (b.latestTelemetry?.powerLoadKw ?? -Infinity)
                          break
                      case 'tickets':
                          cmp = (openOrdersByMachine.get(a.id) ?? 0) - (openOrdersByMachine.get(b.id) ?? 0)
                          break
                      case 'produced':
                          cmp = a.totalProduced - b.totalProduced
                          break
                  }
                  if (cmp === 0) return a.name.localeCompare(b.name)
                  return sortDesc ? -cmp : cmp
              })

    const toggleSort = (key: SortKey) => {
        setPage(1)
        if (sortKey !== key) {
            setSortKey(key)
            setSortDesc(key !== 'name')
        } else if (key === 'name' ? !sortDesc : sortDesc) {
            setSortDesc(!sortDesc)
        } else {
            // Third click returns to static database order
            setSortKey(null)
        }
    }

    // Pagination (10 rows per page in Rows just like original MachineFleet, 9 cards 3x3 in Fleet Cards)
    const pageSize = mode === 'grid' ? 9 : 10
    const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const paginated = ordered.slice((safePage - 1) * pageSize, safePage * pageSize)

    // Radar chart SVG geometry
    const svgW = 560
    const svgH = 315
    const padL = 48
    const padR = 24
    const padT = 20
    const padB = 38
    const plotW = svgW - padL - padR
    const plotH = svgH - padT - padB

    const xOf = (pct: number) => padL + (Math.min(120, Math.max(0, pct)) / 120) * plotW
    const yOf = (pct: number) => padT + plotH - (Math.min(120, Math.max(0, pct)) / 120) * plotH

    const coordsFor = (m: DashboardMachine, idx: number) => {
        const inactive = m.status === 'Offline' || m.status === 'Maintenance'
        const tRatio = getThermalLoadRatio(m, thresholds)
        const vRatio = getVibrationLoadRatio(m, thresholds)
        const noSignal = tRatio === null && vRatio === null
        const tPct = inactive || noSignal ? 8 + (idx % 4) * 4.5 : Math.round((tRatio ?? 0) * 100)
        const vPct = inactive || noSignal ? 6 + Math.floor(idx / 4) * 5 : Math.round((vRatio ?? 0) * 100)
        return { tPct, vPct, cx: xOf(tPct), cy: yOf(vPct) }
    }

    const hoveredMachine = filtered.find(m => m.id === hoveredId) ?? null
    const topWatchlist = [...filtered]
        .sort((a, b) => getMachineStressScore(b, thresholds) - getMachineStressScore(a, thresholds) || a.name.localeCompare(b.name))
        .slice(0, 6)

    const sparkValues = (m: DashboardMachine) => {
        const hist = tempHistoryByMachine[m.id]
        if (hist && hist.length > 0) return hist
        const cur = m.latestTelemetry?.temperature
        return cur !== null && cur !== undefined && Number.isFinite(cur) ? [cur] : []
    }

    const statusOptions: Array<{ value: MachineStatus | 'All'; label: string }> = [
        { value: 'All', label: 'All Statuses' },
        ...machineStatuses.map(s => ({ value: s, label: s })),
    ]

    const paginationFooter = (
        <div
            className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 rounded-b-2xl"
            style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-surface-2)' }}
        >
            <span className="text-xs sf-ops-num" style={{ color: 'var(--sf-muted)' }}>
                Page <strong style={{ color: 'var(--sf-text)' }}>{safePage}</strong> of{' '}
                <strong style={{ color: 'var(--sf-text)' }}>{totalPages}</strong> (Total: {ordered.length} entries)
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: 'var(--sf-surface)',
                        borderColor: 'var(--sf-border-strong)',
                        color: 'var(--sf-text-2)',
                    }}
                >
                    Previous
                </button>
                <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: 'var(--sf-surface)',
                        borderColor: 'var(--sf-border-strong)',
                        color: 'var(--sf-text-2)',
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    )

    return (
        <section className="sf-ops-card overflow-visible" aria-label="Machine fleet explorer">
            {/* Compact Toolbar: Search + Status Filter Dropdown on left, View Switcher on right */}
            <div
                className="px-6 py-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3.5"
                style={{ borderColor: 'var(--sf-border)' }}
            >
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <label
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm"
                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                    >
                        <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                        <input
                            type="search"
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                            placeholder="Search by unit, code, serial or line…"
                            aria-label="Search machines"
                            className="bg-transparent outline-none w-52 sm:w-72 text-sm"
                            style={{ color: 'var(--sf-text)' }}
                        />
                    </label>

                    {/* Status Filter Dropdown */}
                    <div className="relative" ref={statusDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setStatusMenuOpen(v => !v)}
                            aria-haspopup="listbox"
                            aria-expanded={statusMenuOpen}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer min-w-[176px]"
                            style={{
                                background: 'var(--sf-surface-2)',
                                borderColor: statusMenuOpen || statusFilter !== 'All' ? 'var(--sf-accent)' : 'var(--sf-border)',
                                color: 'var(--sf-text)',
                            }}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                {statusFilter === 'All' ? (
                                    <Filter className="w-4 h-4 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                                ) : (
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: statusColorToken(statusFilter) }}
                                    />
                                )}
                                <span className="truncate">
                                    {statusFilter === 'All' ? 'All Statuses' : statusFilter}
                                </span>
                            </span>
                            <ChevronDown
                                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${statusMenuOpen ? 'rotate-180' : ''}`}
                                style={{ color: 'var(--sf-muted)' }}
                            />
                        </button>

                        {statusMenuOpen && (
                            <div
                                role="listbox"
                                aria-label="Filter status"
                                className="absolute left-0 mt-1.5 min-w-[216px] rounded-xl border shadow-xl py-1.5 z-50"
                                style={{
                                    background: 'var(--sf-surface)',
                                    borderColor: 'var(--sf-border-strong)',
                                }}
                            >
                                <div
                                    className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border-b mb-1"
                                    style={{ color: 'var(--sf-muted)', borderColor: 'var(--sf-border)' }}
                                >
                                    Filter Status
                                </div>
                                {statusOptions.map(opt => {
                                    const selected = statusFilter === opt.value
                                    const count = statusCounts[opt.value] ?? 0
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            onClick={() => {
                                                onStatusFilterChange(opt.value)
                                                setPage(1)
                                                setStatusMenuOpen(false)
                                            }}
                                            className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors cursor-pointer"
                                            style={{
                                                background: selected ? 'var(--sf-accent-soft)' : 'transparent',
                                                color: selected ? 'var(--sf-accent)' : 'var(--sf-text)',
                                                fontWeight: selected ? 600 : 400,
                                            }}
                                        >
                                            <span className="flex items-center gap-2.5 min-w-0">
                                                {opt.value !== 'All' ? (
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ background: statusColorToken(opt.value) }}
                                                    />
                                                ) : (
                                                    <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                                                )}
                                                <span className="truncate">{opt.label}</span>
                                            </span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                <span className="sf-ops-num text-xs" style={{ color: 'var(--sf-muted)' }}>
                                                    {count}
                                                </span>
                                                {selected && <Check className="w-4 h-4" style={{ color: 'var(--sf-accent)' }} />}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <span className="text-sm sf-ops-num hidden sm:inline" style={{ color: 'var(--sf-muted)' }}>
                        Showing <strong style={{ color: 'var(--sf-text)' }}>{mode === 'radar' ? filtered.length : paginated.length}</strong> of{' '}
                        <strong style={{ color: 'var(--sf-text)' }}>{ordered.length}</strong> units
                    </span>
                </div>

                {/* View Switcher: Rows (default, left) | Fleet Cards | Stress Radar (right) */}
                <div
                    className="inline-flex p-1 rounded-xl border gap-1 self-start lg:self-auto"
                    style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                    role="tablist"
                    aria-label="Fleet view mode"
                >
                    {[
                        { id: 'table' as const, label: 'Rows', icon: Table2 },
                        { id: 'grid' as const, label: 'Fleet Cards', icon: LayoutGrid },
                        { id: 'radar' as const, label: 'Stress Radar', icon: Crosshair },
                    ].map(item => {
                        const Icon = item.icon
                        const active = mode === item.id
                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => {
                                    setMode(item.id)
                                    setPage(1)
                                }}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                                style={
                                    active
                                        ? {
                                              background: 'var(--sf-surface)',
                                              color: 'var(--sf-accent)',
                                              boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                          }
                                        : { color: 'var(--sf-muted)' }
                                }
                            >
                                <Icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="p-16 text-center text-sm" style={{ color: 'var(--sf-muted)' }}>
                    No machines match the current filter criteria.
                </div>
            ) : (
                <>
                    {/* MODE 1 (DEFAULT): ROWS (STATIC ORDER BY DEFAULT + PAGINATION) */}
                    {mode === 'table' && (
                        <>
                            <div className="overflow-x-auto sf-ops-scroll">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr
                                            className="border-b text-xs uppercase tracking-wider"
                                            style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)', background: 'var(--sf-surface-2)' }}
                                        >
                                            <th className="py-4 px-5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('name')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'name' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Station <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4">Status</th>
                                            <th className="py-4 px-4">Line / Hall</th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('temp')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'temp' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Temp °C <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('vib')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'vib' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Vib mm/s <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('power')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'power' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Power kW <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('stress')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'stress' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Stress <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('tickets')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'tickets' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Tickets <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort('produced')}
                                                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                                                    style={sortKey === 'produced' ? { color: 'var(--sf-accent)' } : undefined}
                                                >
                                                    Produced <ArrowUpDown className="w-3.5 h-3.5" />
                                                </button>
                                            </th>
                                            <th className="py-4 px-5 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map(m => {
                                            const tel = m.latestTelemetry
                                            const col = statusColorToken(m.status)
                                            const stress = getMachineStressScore(m, thresholds)
                                            const selected = m.id === selectedMachineId
                                            const openTickets = openOrdersByMachine.get(m.id) ?? 0

                                            return (
                                                <tr
                                                    key={m.id}
                                                    onClick={() => onSelectMachine(m.id)}
                                                    className="border-b cursor-pointer transition-colors"
                                                    style={{
                                                        borderColor: 'var(--sf-border)',
                                                        background: selected
                                                            ? 'color-mix(in srgb, var(--sf-accent) 7%, var(--sf-surface))'
                                                            : undefined,
                                                    }}
                                                >
                                                    <td className="py-4 px-5 font-semibold text-[15px] leading-snug">
                                                        {m.name}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className="inline-flex items-center gap-2 font-bold text-[13px]" style={{ color: col }}>
                                                            <i className="w-2 h-2 rounded-full inline-block" style={{ background: col }} />
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 text-sm" style={{ color: 'var(--sf-muted)' }}>
                                                        {m.productionLineName ?? shortHallPillName(m.factoryHallName)}
                                                    </td>
                                                    <td className="py-4 px-4 text-right sf-ops-num text-[14.5px] font-semibold">
                                                        {formatMetric(tel?.temperature, 1)}
                                                    </td>
                                                    <td className="py-4 px-4 text-right sf-ops-num text-[14.5px] font-semibold">
                                                        {formatMetric(tel?.vibration, 2)}
                                                    </td>
                                                    <td className="py-4 px-4 text-right sf-ops-num text-[14.5px] font-semibold">
                                                        {formatMetric(tel?.powerLoadKw, 1)}
                                                    </td>
                                                    <td
                                                        className="py-4 px-4 text-right sf-ops-num text-[14.5px] font-bold"
                                                        style={{ color: stress >= 95 ? 'var(--sf-error)' : stress >= 75 ? 'var(--sf-warning)' : col }}
                                                    >
                                                        {stress}%
                                                    </td>
                                                    <td className="py-4 px-4 text-right sf-ops-num">
                                                        {openTickets > 0 ? (
                                                            <span
                                                                className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                                                                style={{ background: 'var(--sf-accent-soft)', color: 'var(--sf-accent)' }}
                                                            >
                                                                {openTickets}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--sf-muted)' }}>0</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-right sf-ops-num text-sm" style={{ color: 'var(--sf-muted)' }}>
                                                        {m.totalProduced > 0 ? m.totalProduced.toLocaleString('en-GB') : '—'}
                                                    </td>
                                                    <td className="py-4 px-5 text-right">
                                                        <Link
                                                            to={`/machines/${m.id}`}
                                                            onClick={e => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors"
                                                            style={{
                                                                background: 'var(--sf-accent-soft)',
                                                                borderColor: 'color-mix(in srgb, var(--sf-accent) 30%, var(--sf-border))',
                                                                color: 'var(--sf-accent)',
                                                            }}
                                                        >
                                                            <span>Details</span>
                                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {paginationFooter}
                        </>
                    )}

                    {/* MODE 2: FLEET CARDS GRID (STATIC ORDER + PAGINATION, MAX 3 COLUMNS) */}
                    {mode === 'grid' && (
                        <>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {paginated.map(m => {
                                    const tel = m.latestTelemetry
                                    const col = statusColorToken(m.status)
                                    const selected = m.id === selectedMachineId
                                    const stress = getMachineStressScore(m, thresholds)

                                    return (
                                        <div
                                            key={m.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onSelectMachine(m.id)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    onSelectMachine(m.id)
                                                }
                                            }}
                                            className="text-left rounded-2xl border p-5 space-y-4 cursor-pointer transition-all hover:-translate-y-0.5"
                                            style={{
                                                background: selected
                                                    ? 'color-mix(in srgb, var(--sf-accent) 7%, var(--sf-surface))'
                                                    : 'var(--sf-surface-2)',
                                                borderColor: selected
                                                    ? 'color-mix(in srgb, var(--sf-accent) 45%, var(--sf-border))'
                                                    : 'var(--sf-border)',
                                                borderTopWidth: '3.5px',
                                                borderTopColor: col,
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                                                        <span className="text-xs font-bold uppercase" style={{ color: col }}>
                                                            {m.status}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-[15px] font-bold truncate mt-1">{m.name}</h3>
                                                </div>
                                                <MiniSparkline values={sparkValues(m)} color={col} />
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="rounded-xl py-2.5 px-2 border" style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}>
                                                    <div className="text-[11px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Temp</div>
                                                    <div className="sf-ops-num text-[15px] font-bold mt-1">{formatMetric(tel?.temperature, 1, '°')}</div>
                                                </div>
                                                <div className="rounded-xl py-2.5 px-2 border" style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}>
                                                    <div className="text-[11px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Vib</div>
                                                    <div className="sf-ops-num text-[15px] font-bold mt-1">{formatMetric(tel?.vibration, 2)}</div>
                                                </div>
                                                <div className="rounded-xl py-2.5 px-2 border" style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}>
                                                    <div className="text-[11px] uppercase font-bold" style={{ color: 'var(--sf-muted)' }}>Power</div>
                                                    <div className="sf-ops-num text-[15px] font-bold mt-1">{formatMetric(tel?.powerLoadKw, 0, 'kW')}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--sf-muted)' }}>
                                                <span className="truncate">{m.productionLineName ?? 'Utility Bay'}</span>
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <span className="sf-ops-num font-bold" style={{ color: col }}>Stress {stress}%</span>
                                                    <Link
                                                        to={`/machines/${m.id}`}
                                                        onClick={e => e.stopPropagation()}
                                                        className="inline-flex items-center gap-0.5 font-semibold hover:underline"
                                                        style={{ color: 'var(--sf-accent)' }}
                                                        title={`Open ${m.name} details`}
                                                    >
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {paginationFooter}
                        </>
                    )}

                    {/* MODE 3: PREDICTIVE STRESS RADAR + WATCHLIST */}
                    {mode === 'radar' && (
                        <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                            {/* Interactive Scatter Quadrant */}
                            <div
                                className="xl:col-span-7 rounded-2xl border p-5 flex flex-col justify-between relative min-w-0"
                                style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                            >
                                <div className="flex items-center justify-between gap-3 mb-3 h-6 min-w-0">
                                    <span className="text-sm font-bold whitespace-nowrap shrink-0">
                                        Thermal vs. Vibration Proximity (% of Critical)
                                    </span>
                                    {hoveredMachine ? (
                                        <span className="sf-ops-num text-[13px] font-semibold truncate whitespace-nowrap min-w-0" style={{ color: 'var(--sf-accent)' }}>
                                            {hoveredMachine.name}: {formatMetric(hoveredMachine.latestTelemetry?.temperature, 1, '°C')} ·{' '}
                                            {formatMetric(hoveredMachine.latestTelemetry?.vibration, 2, ' mm/s')}
                                        </span>
                                    ) : (
                                        <span className="text-xs truncate whitespace-nowrap min-w-0" style={{ color: 'var(--sf-muted)' }}>
                                            Hover or click any node to inspect
                                        </span>
                                    )}
                                </div>

                                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto overflow-visible">
                                    {/* Safe zone */}
                                    <rect
                                        x={padL}
                                        y={yOf(75)}
                                        width={xOf(75) - padL}
                                        height={yOf(0) - yOf(75)}
                                        fill="rgba(16, 185, 129, 0.06)"
                                        rx="4"
                                    />
                                    {/* Warning L-band */}
                                    <rect
                                        x={xOf(75)}
                                        y={yOf(95)}
                                        width={xOf(95) - xOf(75)}
                                        height={yOf(0) - yOf(95)}
                                        fill="rgba(245, 158, 11, 0.08)"
                                    />
                                    <rect
                                        x={padL}
                                        y={yOf(95)}
                                        width={xOf(75) - padL}
                                        height={yOf(75) - yOf(95)}
                                        fill="rgba(245, 158, 11, 0.08)"
                                    />
                                    {/* Critical top/right band */}
                                    <rect
                                        x={xOf(95)}
                                        y={padT}
                                        width={xOf(120) - xOf(95)}
                                        height={plotH}
                                        fill="rgba(239, 68, 68, 0.09)"
                                    />
                                    <rect
                                        x={padL}
                                        y={padT}
                                        width={xOf(95) - padL}
                                        height={yOf(95) - padT}
                                        fill="rgba(239, 68, 68, 0.09)"
                                    />

                                    {/* Grid lines & labels */}
                                    {[0, 25, 50, 75, 100].map(pct => (
                                        <g key={pct}>
                                            <line
                                                x1={padL}
                                                x2={svgW - padR}
                                                y1={yOf(pct)}
                                                y2={yOf(pct)}
                                                stroke="var(--sf-border)"
                                                strokeDasharray={pct === 75 || pct === 100 ? '4 4' : undefined}
                                                strokeWidth={pct === 100 ? 1.3 : 0.9}
                                            />
                                            <line
                                                x1={xOf(pct)}
                                                x2={xOf(pct)}
                                                y1={padT}
                                                y2={svgH - padB}
                                                stroke="var(--sf-border)"
                                                strokeDasharray={pct === 75 || pct === 100 ? '4 4' : undefined}
                                                strokeWidth={pct === 100 ? 1.3 : 0.9}
                                            />
                                            <text x={padL - 9} y={yOf(pct) + 4} textAnchor="end" fontSize="11" fill="var(--sf-muted)" className="sf-ops-num">
                                                {pct}%
                                            </text>
                                            <text x={xOf(pct)} y={svgH - padB + 16} textAnchor="middle" fontSize="11" fill="var(--sf-muted)" className="sf-ops-num">
                                                {pct}%
                                            </text>
                                        </g>
                                    ))}

                                    {/* Zone Corner Labels */}
                                    <text x={padL + 10} y={svgH - padB - 10} fontSize="11" fontWeight="700" fill="var(--sf-running)" opacity="0.82">
                                        NOMINAL ENVELOPE
                                    </text>
                                    <text x={svgW - padR - 8} y={padT + 15} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--sf-error)" opacity="0.88">
                                        CRITICAL TRIP ZONE
                                    </text>

                                    {/* Axis Titles */}
                                    <text x={padL + plotW / 2} y={svgH - 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--sf-muted)">
                                        Thermal Load (% of Critical Temp Limit) →
                                    </text>
                                    <text
                                        x={13}
                                        y={padT + plotH / 2}
                                        textAnchor="middle"
                                        fontSize="11.5"
                                        fontWeight="600"
                                        fill="var(--sf-muted)"
                                        transform={`rotate(-90 13 ${padT + plotH / 2})`}
                                    >
                                        Vibration Load (%) →
                                    </text>

                                    {/* Crosshair Guide on Hover */}
                                    {hoveredMachine && (() => {
                                        const idx = filtered.findIndex(x => x.id === hoveredMachine.id)
                                        const { cx: hx, cy: hy } = coordsFor(hoveredMachine, Math.max(0, idx))
                                        return (
                                            <g pointerEvents="none" opacity="0.65">
                                                <line x1={hx} x2={hx} y1={padT} y2={svgH - padB} stroke="var(--sf-accent)" strokeDasharray="3 3" strokeWidth="1.2" />
                                                <line x1={padL} x2={svgW - padR} y1={hy} y2={hy} stroke="var(--sf-accent)" strokeDasharray="3 3" strokeWidth="1.2" />
                                            </g>
                                        )
                                    })()}

                                    {/* Machine Dots */}
                                    {filtered.map((m, idx) => {
                                        const { tPct, vPct, cx, cy } = coordsFor(m, idx)
                                        const isSel = m.id === selectedMachineId
                                        const isHot = m.status === 'Error' || m.status === 'Warning' || isSel
                                        const fill = statusColorToken(m.status)
                                        const code = machineCode(m)

                                        return (
                                            <g
                                                key={m.id}
                                                style={{ cursor: 'pointer', transition: 'transform 400ms ease' }}
                                                onClick={() => onSelectMachine(m.id)}
                                                onMouseEnter={() => setHoveredId(m.id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                            >
                                                {isSel && (
                                                    <circle cx={cx} cy={cy} r="15" fill="var(--sf-accent-soft)" stroke="var(--sf-accent)" strokeWidth="1.6" />
                                                )}
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={isSel ? 8 : isHot ? 7.2 : 5.8}
                                                    fill={fill}
                                                    stroke="var(--sf-surface)"
                                                    strokeWidth="2"
                                                />
                                                {(isHot || hoveredId === m.id || tPct > 65 || vPct > 65) && (
                                                    <text
                                                        x={cx > svgW - 95 ? cx - 12 : cx + 11}
                                                        y={cy + 4}
                                                        textAnchor={cx > svgW - 95 ? 'end' : 'start'}
                                                        fontSize="11"
                                                        fontWeight="700"
                                                        fill="var(--sf-text)"
                                                        className="sf-ops-num"
                                                    >
                                                        {code}
                                                    </text>
                                                )}
                                            </g>
                                        )
                                    })}
                                </svg>
                            </div>

                            {/* Right Column: Highest Composite Stress Watchlist */}
                            <div className="xl:col-span-5 flex flex-col gap-3 min-w-0">
                                <div className="flex items-center justify-between gap-2 h-6">
                                    <span className="text-sm font-bold whitespace-nowrap">Highest Stress Watchlist</span>
                                    <span className="text-xs truncate whitespace-nowrap" style={{ color: 'var(--sf-muted)' }}>
                                        Ranked by threshold proximity
                                    </span>
                                </div>

                                <div className="space-y-2.5">
                                    {topWatchlist.map(m => {
                                        const tel = m.latestTelemetry
                                        const stress = getMachineStressScore(m, thresholds)
                                        const col = statusColorToken(m.status)
                                        const selected = m.id === selectedMachineId

                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => onSelectMachine(m.id)}
                                                className="w-full h-[72px] text-left rounded-xl border px-4 flex items-center justify-between gap-3.5 cursor-pointer transition-colors overflow-hidden"
                                                style={{
                                                    background: selected
                                                        ? 'color-mix(in srgb, var(--sf-accent) 7%, var(--sf-surface))'
                                                        : 'var(--sf-surface-2)',
                                                    borderColor: selected
                                                        ? 'color-mix(in srgb, var(--sf-accent) 45%, var(--sf-border))'
                                                        : 'var(--sf-border)',
                                                }}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <span
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                        style={{ background: 'var(--sf-surface)', color: col }}
                                                    >
                                                        <MachineIcon name={m.icon} className="w-5 h-5 flex items-center justify-center" fontSize="small" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[14.5px] font-bold truncate whitespace-nowrap leading-snug">
                                                            {m.name}
                                                        </div>
                                                        <div className="sf-ops-num text-xs mt-0.5 truncate whitespace-nowrap leading-snug" style={{ color: 'var(--sf-muted)' }}>
                                                            {formatMetric(tel?.temperature, 1, '°C')} · {formatMetric(tel?.vibration, 2, ' mm/s')} · {formatMetric(tel?.powerLoadKw, 1, ' kW')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3.5 shrink-0">
                                                    <MiniSparkline values={sparkValues(m)} color={col} />
                                                    <div className="text-right w-12">
                                                        <div
                                                            className="sf-ops-num text-[15px] font-extrabold leading-snug"
                                                            style={{
                                                                color: stress >= 95 ? 'var(--sf-error)' : stress >= 75 ? 'var(--sf-warning)' : 'var(--sf-text)',
                                                            }}
                                                        >
                                                            {stress}%
                                                        </div>
                                                        <div className="text-[11px] uppercase font-bold leading-snug" style={{ color: 'var(--sf-muted)' }}>
                                                            Stress
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
