import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
    Activity,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Flame,
    Menu,
    Moon,
    Radio,
    RefreshCw,
    Search,
    Sun,
    TriangleAlert,
    X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFactory } from '../../context/FactoryContext'
import { NavigationContext } from '../../context/NavigationContext'
import { dispatchDashboardWorkOrder } from '../../services/dashboardService'
import { fetchIncidentHistory, updateIncidentStatus } from '../../services/incidentsService'
import { simulationError } from '../../services/simulationService'
import type {
    IncidentActivityBucket,
    IncidentHistoryItem,
    IncidentHistoryResponse,
    IncidentRange,
    IncidentSeverity,
    IncidentStatus,
    IncidentStatusFilter,
} from '../../types/incident'
import { telemetryTimestamp } from '../../utils/telemetrySeries'
import Select from '../common/Select'
import { formatRelativeTime, shortHallPillName } from '../live_dashboard/operations/operationsHelpers'
import IncidentDetailDrawer, { parseIncidentDisplay } from './IncidentDetailDrawer'
import '../live_dashboard/operations/operations-dashboard.css'

const THEME_STORAGE_KEY = 'sf-operations-theme'
const PAGE_SIZE = 15
const COUNT_CAP = 9999

const RANGE_OPTIONS: { value: IncidentRange; label: string; dropdownLabel: string }[] = [
    { value: '24h', label: '24h', dropdownLabel: 'Last 24 hours' },
    { value: '7d', label: '7d', dropdownLabel: 'Last 7 days' },
    { value: '30d', label: '30d', dropdownLabel: 'Last 30 days' },
    { value: 'all', label: 'All', dropdownLabel: 'All time' },
]

function formatCappedCount(count: number): { label: string; exactTitle?: string } {
    if (count > COUNT_CAP) {
        return {
            label: `${COUNT_CAP}+`,
            exactTitle: `${count.toLocaleString('en-GB')} incidents`,
        }
    }
    return {
        label: String(count),
        exactTitle: count >= 1000 ? `${count.toLocaleString('en-GB')} incidents` : undefined,
    }
}

function formatRowTime(timestampUtc: string, nowMs: number): string {
    const ts = telemetryTimestamp(timestampUtc)
    if (!Number.isFinite(ts)) return '—'
    const diffHours = (nowMs - ts) / 3_600_000
    if (diffHours < 48) {
        return formatRelativeTime(timestampUtc, nowMs)
    }
    return new Date(ts).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function IncidentHistoryPage() {
    const { user } = useAuth()
    const { halls, selectedHallId, setSelectedHallId, isLoadingHalls } = useFactory()
    const navigation = useContext(NavigationContext)
    const isSuperAdmin = user?.role === 'SuperAdmin'

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return stored === 'dark' ? 'dark' : 'light'
    })

    const [range, setRange] = useState<IncidentRange>('7d')
    const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>('All')
    const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'All'>('All')
    const [machineFilter, setMachineFilter] = useState<{ id: string; name: string } | null>(null)
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)

    const [data, setData] = useState<IncidentHistoryResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [pulseRefreshing, setPulseRefreshing] = useState(false)
    const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [selectedIncident, setSelectedIncident] = useState<IncidentHistoryItem | null>(null)
    const [hoveredBucket, setHoveredBucket] = useState<IncidentActivityBucket | null>(null)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [now, setNow] = useState<number>(() => Date.now())
    const [toast, setToast] = useState<string | null>(null)
    const toastTimerRef = useRef<number | null>(null)
    const pulseSpinTimerRef = useRef<number | null>(null)
    const rangeChangeRef = useRef(false)
    const rangeDropdownRef = useRef<HTMLDivElement>(null)

    const showToast = (message: string) => {
        setToast(message)
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
    }

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'light' ? 'dark' : 'light'
            localStorage.setItem(THEME_STORAGE_KEY, next)
            return next
        })
    }

    // Keep relative timestamps fresh
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000)
        return () => window.clearInterval(timer)
    }, [])

    // Debounce search input
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput)
            setPage(1)
        }, 240)
        return () => window.clearTimeout(timer)
    }, [searchInput])

    // Close range dropdown on outside click or Escape
    useEffect(() => {
        if (!rangeMenuOpen) return
        const handleOutside = (e: MouseEvent) => {
            if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(e.target as Node)) {
                setRangeMenuOpen(false)
            }
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setRangeMenuOpen(false)
        }
        document.addEventListener('mousedown', handleOutside)
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('mousedown', handleOutside)
            document.removeEventListener('keydown', handleKey)
        }
    }, [rangeMenuOpen])

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
            if (pulseSpinTimerRef.current) window.clearTimeout(pulseSpinTimerRef.current)
        }
    }, [])

    const handleRangeChange = (nextRange: IncidentRange) => {
        setRangeMenuOpen(false)
        if (nextRange === range) return
        rangeChangeRef.current = true
        setPulseRefreshing(true)
        if (pulseSpinTimerRef.current) window.clearTimeout(pulseSpinTimerRef.current)
        setRange(nextRange)
        setPage(1)
    }

    // Reset page and machine filter on hall switch
    const handleHallChange = (hallId: string | null) => {
        setSelectedHallId(hallId)
        setMachineFilter(null)
        setPage(1)
    }

    const loadHistory = useCallback(
        async (signal?: AbortSignal, silent = false) => {
            const startedAt = Date.now()
            if (silent) setRefreshing(true)
            else setLoading(prev => prev || !data)
            try {
                const response = await fetchIncidentHistory(
                    {
                        page,
                        pageSize: PAGE_SIZE,
                        factoryHallId: isSuperAdmin ? selectedHallId : null,
                        machineId: machineFilter?.id ?? null,
                        status: statusFilter,
                        severity: severityFilter,
                        range,
                        search: debouncedSearch,
                    },
                    signal,
                )
                if (signal?.aborted) return
                setData(response)
                setError(null)
                setSelectedIncident(curr =>
                    curr ? response.items.data.find(i => i.id === curr.id) ?? curr : null,
                )
            } catch (err) {
                if (signal?.aborted) return
                setError(simulationError(err))
            } finally {
                if (!signal?.aborted) {
                    setLoading(false)
                    setRefreshing(false)
                    if (rangeChangeRef.current) {
                        rangeChangeRef.current = false
                        const elapsed = Date.now() - startedAt
                        const remaining = Math.max(0, 320 - elapsed)
                        if (pulseSpinTimerRef.current) window.clearTimeout(pulseSpinTimerRef.current)
                        pulseSpinTimerRef.current = window.setTimeout(() => setPulseRefreshing(false), remaining)
                    }
                }
            }
        },
        [page, isSuperAdmin, selectedHallId, machineFilter?.id, statusFilter, severityFilter, range, debouncedSearch],
    )

    useEffect(() => {
        const controller = new AbortController()
        void loadHistory(controller.signal, Boolean(data))
        return () => controller.abort()
    }, [loadHistory])

    const handleUpdateStatus = async (incident: IncidentHistoryItem, nextStatus: IncidentStatus) => {
        setBusyAction(`status-${incident.id}`)
        try {
            await updateIncidentStatus(incident.id, nextStatus)
            setSelectedIncident(curr => (curr?.id === incident.id ? { ...curr, status: nextStatus } : curr))
            await loadHistory(undefined, true)
            showToast(
                nextStatus === 'Acknowledged'
                    ? 'Incident acknowledged'
                    : nextStatus === 'Resolved'
                      ? 'Incident marked resolved'
                      : 'Incident reopened',
            )
        } catch (err) {
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const handleDispatchTech = async (incident: IncidentHistoryItem) => {
        setBusyAction(`dispatch-${incident.id}`)
        try {
            const parsed = parseIncidentDisplay(incident)
            const created = await dispatchDashboardWorkOrder(
                incident.machineId,
                `${incident.severity === 'Critical' ? 'Emergency' : 'Diagnostic'}: ${parsed.headline}`,
                incident.severity === 'Critical' ? 'Critical' : 'Predictive',
            )
            await loadHistory(undefined, true)
            showToast(`Dispatched ${created.assigneeName ?? 'technician'} · ${created.ticketNumber}`)
        } catch (err) {
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const hallOptions = isSuperAdmin
        ? [{ value: null, label: 'All Factory Halls' }, ...halls.map(h => ({ value: h.id, label: h.name }))]
        : halls.map(h => ({ value: h.id, label: h.name }))
    const assignedHall = halls.find(h => h.id === (selectedHallId ?? user?.factoryHallId))
    const showHallPills = isSuperAdmin && halls.length > 0 && halls.length <= 3
    const showingAllHalls = isSuperAdmin && !selectedHallId

    const summary = data?.summary
    const items = data?.items.data ?? []
    const totalCount = data?.items.totalCount ?? 0
    const totalPages = Math.max(1, data?.items.totalPages ?? 1)
    const activity = data?.activity ?? []
    const hotspots = data?.hotspots ?? []

    const maxBucketTotal = Math.max(
        1,
        ...activity.map(b => b.criticalCount + b.warningCount),
    )
    const maxHotspotCount = Math.max(1, ...hotspots.map(h => h.totalCount))

    const openTotal = summary ? summary.active + summary.acknowledged : 0

    const statusTabs: { value: IncidentStatusFilter; label: string; count?: number }[] = [
        { value: 'All', label: 'All', count: summary?.total },
        { value: 'Open', label: 'Open', count: summary ? openTotal : undefined },
        { value: 'Active', label: 'Active', count: summary?.active },
        { value: 'Acknowledged', label: 'Ack', count: summary?.acknowledged },
        { value: 'Resolved', label: 'Resolved', count: summary?.resolved },
    ]

    const startIdx = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const endIdx = Math.min(page * PAGE_SIZE, totalCount)

    return (
        <div className="sf-ops-root flex flex-col min-h-full relative" data-theme={theme}>
            {/* Header matching Live Operations & Machine Fleet */}
            <header
                className="sticky top-0 z-30 min-h-16 sm:h-16 border-b px-4 md:px-7 py-2 sm:py-0 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md shrink-0"
                style={{
                    background: 'color-mix(in srgb, var(--sf-surface) 92%, transparent)',
                    borderColor: 'var(--sf-border)',
                }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {navigation && (
                        <button
                            type="button"
                            onClick={navigation.toggle}
                            className="md:hidden p-1.5 rounded-lg border cursor-pointer"
                            style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            aria-label="Toggle navigation"
                            aria-controls="app-sidebar"
                            aria-expanded={navigation.isOpen}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    )}
                    <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-none truncate">
                        Incident History
                    </h1>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {showHallPills ? (
                        <div
                            className="inline-flex items-center p-1 rounded-xl border gap-0.5"
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                            role="group"
                            aria-label="Select factory hall"
                        >
                            <Building2 className="w-3.5 h-3.5 mx-1.5 hidden sm:block" style={{ color: 'var(--sf-muted)' }} />
                            {[
                                { id: null, label: 'All Halls' },
                                ...halls.map(h => ({ id: h.id, label: shortHallPillName(h.name) })),
                            ].map(opt => {
                                const active = selectedHallId === opt.id
                                return (
                                    <button
                                        key={opt.id ?? 'all'}
                                        type="button"
                                        onClick={() => handleHallChange(opt.id)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
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
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    ) : isSuperAdmin && halls.length > 3 ? (
                        <Select
                            value={selectedHallId}
                            onChange={val => handleHallChange(val)}
                            options={hallOptions}
                            icon={<Building2 className="w-4 h-4 text-slate-500" />}
                            disabled={isLoadingHalls}
                            headerTitle="Select Factory Hall"
                        />
                    ) : assignedHall ? (
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold"
                            style={{
                                background: 'var(--sf-surface-2)',
                                borderColor: 'var(--sf-border)',
                                color: 'var(--sf-text-2)',
                            }}
                        >
                            <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--sf-muted)' }} />
                            <span className="truncate max-w-[220px]">{shortHallPillName(assignedHall.name)}</span>
                        </span>
                    ) : null}

                    <button
                        type="button"
                        disabled={refreshing}
                        onClick={() => void loadHistory(undefined, true)}
                        className="inline-flex items-center justify-center p-2 rounded-xl border cursor-pointer transition-all disabled:opacity-50"
                        style={{
                            background: 'var(--sf-surface)',
                            borderColor: 'var(--sf-border)',
                            color: 'var(--sf-text-2)',
                        }}
                        aria-label="Refresh incidents"
                        title="Refresh incidents"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="inline-flex items-center justify-center p-2 rounded-xl border cursor-pointer transition-all"
                        style={{
                            background: theme === 'dark' ? 'var(--sf-accent-soft)' : 'var(--sf-surface)',
                            borderColor: theme === 'dark' ? 'var(--sf-accent)' : 'var(--sf-border)',
                            color: theme === 'dark' ? 'var(--sf-accent)' : 'var(--sf-text-2)',
                        }}
                        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                        title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                    >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="p-2.5 sm:p-3.5 md:p-4 space-y-3 w-full flex-1">
                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border px-4 py-3 flex items-center gap-2.5 text-xs"
                        style={{
                            background: 'var(--sf-warning-bg)',
                            borderColor: 'color-mix(in srgb, var(--sf-warning) 50%, var(--sf-border))',
                            color: 'var(--sf-text)',
                        }}
                    >
                        <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: 'var(--sf-warning)' }} />
                        <span className="flex-1">{error}</span>
                        <button
                            type="button"
                            onClick={() => void loadHistory(undefined, true)}
                            className="font-bold underline cursor-pointer shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!data && loading ? (
                    <div
                        className="sf-ops-card p-10 flex items-center justify-center gap-2.5 text-sm"
                        role="status"
                        style={{ color: 'var(--sf-muted)' }}
                    >
                        <Activity className="w-5 h-5 animate-pulse" style={{ color: 'var(--sf-accent)' }} />
                        <span>Loading incident log…</span>
                    </div>
                ) : (
                    <>
                        {/* Compact Top Row: Incident Pulse Timeline + Recurring Hotspots (no duplicated KPI numbers) */}
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3">
                            {/* Left: Incident Activity Pulse */}
                            <section className="sf-ops-card p-4 flex flex-col justify-between gap-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xs font-bold uppercase tracking-wider">
                                                Incident Pulse
                                            </h2>
                                            <span className="inline-flex items-center gap-2.5 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sf-error)' }} />
                                                    Critical
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sf-warning)' }} />
                                                    Warning
                                                </span>
                                            </span>
                                        </div>
                                        <p className="text-[11px] mt-0.5 sf-ops-num" style={{ color: 'var(--sf-muted)' }}>
                                            {hoveredBucket
                                                ? `${hoveredBucket.label} · ${hoveredBucket.criticalCount} critical, ${hoveredBucket.warningCount} warning`
                                                : range === '24h'
                                                  ? 'Last 24 hours · 2h intervals'
                                                  : range === '7d'
                                                    ? 'Last 7 days · daily volume'
                                                    : range === '30d'
                                                      ? 'Last 30 days · 2-day volume'
                                                      : 'Recent 14-day incident activity'}
                                        </p>
                                    </div>

                                    <div className="inline-flex items-center gap-2">
                                        {pulseRefreshing && (
                                            <RefreshCw
                                                className="w-3.5 h-3.5 animate-spin shrink-0"
                                                style={{ color: 'var(--sf-accent)' }}
                                                aria-label="Refreshing incident pulse"
                                            />
                                        )}
                                        <div
                                            className="inline-flex items-center p-0.5 rounded-lg border gap-0.5"
                                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                            role="group"
                                            aria-label="Time window"
                                        >
                                            {RANGE_OPTIONS.map(opt => {
                                                const active = range === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => handleRangeChange(opt.value)}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer"
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
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Featherweight Stacked Bar Strip */}
                                <div
                                    className={`flex items-end gap-1.5 h-[68px] pt-1 transition-opacity duration-150 ${pulseRefreshing ? 'opacity-50' : 'opacity-100'}`}
                                    onMouseLeave={() => setHoveredBucket(null)}
                                >
                                    {activity.map(bucket => {
                                        const total = bucket.criticalCount + bucket.warningCount
                                        const critPct = total > 0 ? (bucket.criticalCount / maxBucketTotal) * 100 : 0
                                        const warnPct = total > 0 ? (bucket.warningCount / maxBucketTotal) * 100 : 0
                                        const isHovered = hoveredBucket?.startUtc === bucket.startUtc
                                        return (
                                            <div
                                                key={bucket.startUtc}
                                                onMouseEnter={() => setHoveredBucket(bucket)}
                                                className="flex-1 h-full flex flex-col justify-end items-center gap-1 group cursor-default"
                                            >
                                                <div className="w-full flex-1 flex flex-col justify-end gap-[1.5px] max-w-[26px]">
                                                    {total === 0 ? (
                                                        <div
                                                            className="w-full h-[3px] rounded-full opacity-35"
                                                            style={{ background: 'var(--sf-border-strong)' }}
                                                        />
                                                    ) : (
                                                        <>
                                                            {bucket.criticalCount > 0 && (
                                                                <div
                                                                    className="w-full rounded-t-[3px] transition-opacity"
                                                                    style={{
                                                                        height: `${Math.max(10, critPct)}%`,
                                                                        background: 'var(--sf-error)',
                                                                        opacity: hoveredBucket && !isHovered ? 0.5 : 0.92,
                                                                    }}
                                                                />
                                                            )}
                                                            {bucket.warningCount > 0 && (
                                                                <div
                                                                    className={`w-full ${bucket.criticalCount === 0 ? 'rounded-t-[3px]' : ''} rounded-b-[2px] transition-opacity`}
                                                                    style={{
                                                                        height: `${Math.max(10, warnPct)}%`,
                                                                        background: 'var(--sf-warning)',
                                                                        opacity: hoveredBucket && !isHovered ? 0.5 : 0.88,
                                                                    }}
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <span
                                                    className="text-[9.5px] sf-ops-num leading-none truncate max-w-full hidden sm:block"
                                                    style={{ color: isHovered ? 'var(--sf-text)' : 'var(--sf-muted)' }}
                                                >
                                                    {bucket.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>

                            {/* Right: Recurring Hotspots (click to filter log by machine) */}
                            <section className="sf-ops-card p-4 flex flex-col justify-between gap-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <Flame className="w-3.5 h-3.5" style={{ color: 'var(--sf-warning)' }} />
                                        <h2 className="text-xs font-bold uppercase tracking-wider">
                                            Recurring Units
                                        </h2>
                                    </div>
                                    <span className="text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                                        Click to filter
                                    </span>
                                </div>

                                {hotspots.length === 0 ? (
                                    <div className="text-xs py-5 text-center" style={{ color: 'var(--sf-muted)' }}>
                                        No incidents in this period.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {hotspots.map(spot => {
                                            const active = machineFilter?.id === spot.machineId
                                            const widthPct = Math.max(8, Math.round((spot.totalCount / maxHotspotCount) * 100))
                                            return (
                                                <button
                                                    key={spot.machineId}
                                                    type="button"
                                                    onClick={() => {
                                                        setMachineFilter(curr =>
                                                            curr?.id === spot.machineId
                                                                ? null
                                                                : { id: spot.machineId, name: spot.machineName },
                                                        )
                                                        setPage(1)
                                                    }}
                                                    className="w-full text-left rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer"
                                                    style={{
                                                        background: active ? 'var(--sf-accent-soft)' : 'var(--sf-surface-2)',
                                                        borderColor: active ? 'var(--sf-accent)' : 'var(--sf-border)',
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between gap-2 text-xs">
                                                        <span className="font-semibold truncate">{spot.machineName}</span>
                                                        <span className="sf-ops-num text-[11px] font-bold shrink-0 flex items-center gap-1.5">
                                                            {spot.criticalCount > 0 && (
                                                                <span
                                                                    className="px-1.5 py-0.2 rounded text-[10px]"
                                                                    style={{
                                                                        background: 'var(--sf-error-bg)',
                                                                        color: 'var(--sf-error)',
                                                                    }}
                                                                    title={formatCappedCount(spot.criticalCount).exactTitle}
                                                                >
                                                                    {formatCappedCount(spot.criticalCount).label} crit
                                                                </span>
                                                            )}
                                                            <span title={formatCappedCount(spot.totalCount).exactTitle}>
                                                                {formatCappedCount(spot.totalCount).label}
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="h-1 w-full rounded-full mt-1.5 overflow-hidden"
                                                        style={{ background: 'var(--sf-border)' }}
                                                    >
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${widthPct}%`,
                                                                background:
                                                                    spot.criticalCount > 0
                                                                        ? 'var(--sf-error)'
                                                                        : 'var(--sf-warning)',
                                                            }}
                                                        />
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Main Incident Log Card */}
                        <section className="sf-ops-card overflow-hidden" aria-label="Incident log">
                            {/* Unified Filter Toolbar */}
                            <div
                                className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2.5"
                                style={{ borderColor: 'var(--sf-border)' }}
                            >
                                <div className="flex items-center flex-wrap gap-2">
                                    {/* Status segmented tabs with capped counts (9999+ with exact tooltip) */}
                                    <div
                                        className="inline-flex items-center p-0.5 rounded-xl border gap-0.5"
                                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                        role="tablist"
                                        aria-label="Filter by status"
                                    >
                                        {statusTabs.map(tab => {
                                            const active = statusFilter === tab.value
                                            const formatted =
                                                tab.count !== undefined ? formatCappedCount(tab.count) : null
                                            return (
                                                <button
                                                    key={tab.value}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={active}
                                                    title={formatted?.exactTitle}
                                                    onClick={() => {
                                                        setStatusFilter(tab.value)
                                                        setPage(1)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
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
                                                    <span>{tab.label}</span>
                                                    {formatted && (
                                                        <span className="sf-ops-num text-[10.5px] opacity-75">
                                                            {formatted.label}
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Period dropdown filter (defaults to Last 7 days, synced with Incident Pulse) */}
                                    <div className="relative" ref={rangeDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setRangeMenuOpen(open => !open)}
                                            aria-haspopup="listbox"
                                            aria-expanded={rangeMenuOpen}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors"
                                            style={{
                                                background: 'var(--sf-surface-2)',
                                                borderColor: rangeMenuOpen ? 'var(--sf-accent)' : 'var(--sf-border)',
                                                color: 'var(--sf-text)',
                                            }}
                                        >
                                            <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                                            <span>
                                                {RANGE_OPTIONS.find(r => r.value === range)?.dropdownLabel ?? 'Last 7 days'}
                                            </span>
                                            <ChevronDown
                                                className={`w-3.5 h-3.5 transition-transform ${rangeMenuOpen ? 'rotate-180' : ''}`}
                                                style={{ color: 'var(--sf-muted)' }}
                                            />
                                        </button>

                                        {rangeMenuOpen && (
                                            <div
                                                role="listbox"
                                                aria-label="Filter by time period"
                                                className="absolute left-0 mt-1.5 w-40 rounded-xl border shadow-xl p-1 z-30"
                                                style={{
                                                    background: 'var(--sf-surface)',
                                                    borderColor: 'var(--sf-border-strong)',
                                                }}
                                            >
                                                {RANGE_OPTIONS.map(opt => {
                                                    const selected = range === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={selected}
                                                            onClick={() => handleRangeChange(opt.value)}
                                                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                            style={{
                                                                background: selected ? 'var(--sf-accent-soft)' : 'transparent',
                                                                color: selected ? 'var(--sf-accent)' : 'var(--sf-text)',
                                                            }}
                                                        >
                                                            <span>{opt.dropdownLabel}</span>
                                                            {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Severity filter */}
                                    <div
                                        className="inline-flex items-center p-0.5 rounded-xl border gap-0.5"
                                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                        role="group"
                                        aria-label="Filter by severity"
                                    >
                                        {(['All', 'Critical', 'Warning'] as const).map(sev => {
                                            const active = severityFilter === sev
                                            return (
                                                <button
                                                    key={sev}
                                                    type="button"
                                                    onClick={() => {
                                                        setSeverityFilter(sev)
                                                        setPage(1)
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                                    style={
                                                        active
                                                            ? {
                                                                  background: 'var(--sf-surface)',
                                                                  color:
                                                                      sev === 'Critical'
                                                                          ? 'var(--sf-error)'
                                                                          : sev === 'Warning'
                                                                            ? 'var(--sf-warning)'
                                                                            : 'var(--sf-text)',
                                                                  boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                                              }
                                                            : { color: 'var(--sf-muted)' }
                                                    }
                                                >
                                                    {sev}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Active hotspot machine filter chip */}
                                    {machineFilter && (
                                        <span
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                                            style={{
                                                background: 'var(--sf-accent-soft)',
                                                borderColor: 'var(--sf-accent)',
                                                color: 'var(--sf-accent)',
                                            }}
                                        >
                                            <span className="truncate max-w-[180px]">{machineFilter.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMachineFilter(null)
                                                    setPage(1)
                                                }}
                                                className="hover:opacity-75 cursor-pointer"
                                                aria-label="Clear machine filter"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    )}
                                </div>

                                {/* Search */}
                                <div className="relative w-full sm:w-64">
                                    <Search
                                        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--sf-muted)' }}
                                    />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={e => setSearchInput(e.target.value)}
                                        placeholder="Search machine, serial, event…"
                                        className="w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs outline-none transition-colors"
                                        style={{
                                            background: 'var(--sf-surface-2)',
                                            borderColor: 'var(--sf-border)',
                                            color: 'var(--sf-text)',
                                        }}
                                    />
                                    {searchInput && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchInput('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                                            style={{ color: 'var(--sf-muted)' }}
                                            aria-label="Clear search"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Clean 5-Column Log Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr
                                            className="border-b text-[10.5px] font-bold uppercase tracking-wider"
                                            style={{
                                                borderColor: 'var(--sf-border)',
                                                background: 'var(--sf-surface-2)',
                                                color: 'var(--sf-muted)',
                                            }}
                                        >
                                            <th className="py-2.5 pl-4 pr-3">Event</th>
                                            <th className="py-2.5 px-3">Machine</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Reading</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Triggered</th>
                                            <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="py-12 px-4 text-center text-xs"
                                                    style={{ color: 'var(--sf-muted)' }}
                                                >
                                                    No incidents match the current filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map(item => {
                                                const parsed = parseIncidentDisplay(item)
                                                const isCritical = item.severity === 'Critical'
                                                const isResolved = item.status === 'Resolved'
                                                const isSelected = selectedIncident?.id === item.id
                                                const sevColor = isCritical ? 'var(--sf-error)' : 'var(--sf-warning)'
                                                const statusStyle =
                                                    isResolved
                                                        ? { bg: 'var(--sf-running-bg)', fg: 'var(--sf-running)' }
                                                        : item.status === 'Acknowledged'
                                                          ? { bg: 'var(--sf-accent-soft)', fg: 'var(--sf-accent)' }
                                                          : {
                                                                bg: isCritical ? 'var(--sf-error-bg)' : 'var(--sf-warning-bg)',
                                                                fg: sevColor,
                                                            }
                                                const fullDate = new Date(
                                                    telemetryTimestamp(item.triggeredAtUtc),
                                                ).toLocaleString('en-GB')
                                                const isBusyRow = busyAction === `status-${item.id}`

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => setSelectedIncident(item)}
                                                        className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-slate-500/[0.05]"
                                                        style={{
                                                            borderColor: 'var(--sf-border)',
                                                            background: isSelected
                                                                ? 'var(--sf-accent-soft)'
                                                                : undefined,
                                                            opacity: isResolved ? 0.72 : 1,
                                                        }}
                                                    >
                                                        {/* 1. Event */}
                                                        <td
                                                            className="py-3 pl-4 pr-3 max-w-[380px]"
                                                            style={{
                                                                borderLeft: `3px solid ${isResolved ? 'transparent' : sevColor}`,
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span
                                                                    className="w-2 h-2 rounded-full shrink-0"
                                                                    style={{ background: sevColor }}
                                                                    title={item.severity}
                                                                />
                                                                <span className="text-xs font-semibold truncate">
                                                                    {parsed.headline}
                                                                </span>
                                                                <span
                                                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 hidden md:inline"
                                                                    style={{
                                                                        background: 'var(--sf-surface-2)',
                                                                        color: 'var(--sf-muted)',
                                                                    }}
                                                                >
                                                                    {parsed.category}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 2. Machine */}
                                                        <td className="py-3 px-3 max-w-[240px]">
                                                            <div className="text-xs font-semibold truncate">
                                                                {item.machineName}
                                                            </div>
                                                            <div
                                                                className="text-[11px] truncate mt-0.5"
                                                                style={{ color: 'var(--sf-muted)' }}
                                                            >
                                                                {item.productionLineName ?? 'Utility'}
                                                                {showingAllHalls
                                                                    ? ` · ${shortHallPillName(item.factoryHallName)}`
                                                                    : ''}
                                                            </div>
                                                        </td>

                                                        {/* 3. Reading */}
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            {parsed.readingPill ? (
                                                                <span
                                                                    className="sf-ops-num text-[11px] font-bold px-2 py-0.5 rounded-md"
                                                                    style={{
                                                                        background: isResolved
                                                                            ? 'var(--sf-surface-2)'
                                                                            : isCritical
                                                                              ? 'var(--sf-error-bg)'
                                                                              : 'var(--sf-warning-bg)',
                                                                        color: isResolved ? 'var(--sf-muted)' : sevColor,
                                                                    }}
                                                                >
                                                                    {parsed.readingPill}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs" style={{ color: 'var(--sf-muted)' }}>
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* 4. Triggered */}
                                                        <td
                                                            className="py-3 px-3 whitespace-nowrap sf-ops-num text-xs"
                                                            style={{ color: 'var(--sf-muted)' }}
                                                            title={fullDate}
                                                        >
                                                            {formatRowTime(item.triggeredAtUtc, now)}
                                                        </td>

                                                        {/* 5. Status & single quick action */}
                                                        <td
                                                            className="py-3 pl-3 pr-4 whitespace-nowrap text-right"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                <span
                                                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                                                                    style={{
                                                                        background: statusStyle.bg,
                                                                        color: statusStyle.fg,
                                                                    }}
                                                                >
                                                                    {item.status}
                                                                </span>

                                                                {item.status === 'Active' && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={isBusyRow}
                                                                        onClick={() =>
                                                                            void handleUpdateStatus(item, 'Acknowledged')
                                                                        }
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors disabled:opacity-50"
                                                                        style={{
                                                                            background: 'var(--sf-surface)',
                                                                            borderColor: 'var(--sf-border-strong)',
                                                                            color: 'var(--sf-text)',
                                                                        }}
                                                                        title="Acknowledge incident"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        <span>Ack</span>
                                                                    </button>
                                                                )}

                                                                {item.status === 'Acknowledged' && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={isBusyRow}
                                                                        onClick={() =>
                                                                            void handleUpdateStatus(item, 'Resolved')
                                                                        }
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition-colors disabled:opacity-50"
                                                                        title="Mark incident resolved"
                                                                    >
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        <span>Resolve</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            <div
                                className="px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            >
                                <span className="sf-ops-num" title={formatCappedCount(totalCount).exactTitle}>
                                    Showing {startIdx.toLocaleString('en-GB')}–{endIdx.toLocaleString('en-GB')} of{' '}
                                    {formatCappedCount(totalCount).label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{
                                            background: 'var(--sf-surface)',
                                            borderColor: 'var(--sf-border)',
                                            color: 'var(--sf-text)',
                                        }}
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Prev</span>
                                    </button>
                                    <span className="sf-ops-num px-2 font-semibold" style={{ color: 'var(--sf-text)' }}>
                                        {page} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{
                                            background: 'var(--sf-surface)',
                                            borderColor: 'var(--sf-border)',
                                            color: 'var(--sf-text)',
                                        }}
                                    >
                                        <span>Next</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* Subtle Footer matching Live Operations & Machine Fleet */}
                <footer
                    className="flex flex-wrap items-center justify-between gap-2 pt-0.5 pb-2 px-1 text-[11px]"
                    style={{ color: 'var(--sf-muted)' }}
                >
                    <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5" style={{ color: 'var(--sf-accent)' }} />
                        SmartFactory CMMS
                        {data && (
                            <>
                                {' '}· Synced{' '}
                                <time className="sf-ops-num" dateTime={data.generatedAtUtc}>
                                    {new Date(data.generatedAtUtc).toLocaleTimeString('en-GB')}
                                </time>
                            </>
                        )}
                    </span>
                </footer>
            </div>

            {/* Slide-Over Detail Drawer */}
            <IncidentDetailDrawer
                incident={selectedIncident}
                now={now}
                busyAction={busyAction}
                onClose={() => setSelectedIncident(null)}
                onUpdateStatus={(inc, next) => void handleUpdateStatus(inc, next)}
                onDispatchTech={inc => void handleDispatchTech(inc)}
            />

            {/* Toast feedback */}
            {toast && (
                <div
                    role="status"
                    aria-live="polite"
                    className="sf-ops-toast fixed bottom-6 left-6 md:left-[280px] z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xl flex items-center gap-2 max-w-md"
                    style={{
                        background: 'var(--sf-surface)',
                        borderColor: 'var(--sf-accent)',
                        color: 'var(--sf-text)',
                    }}
                >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--sf-accent)' }} />
                    <span>{toast}</span>
                </div>
            )}
        </div>
    )
}
