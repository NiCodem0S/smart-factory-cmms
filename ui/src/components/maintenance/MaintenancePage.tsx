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
    Cpu,
    Kanban,
    List,
    Menu,
    Moon,
    Play,
    Plus,
    Radio,
    RefreshCw,
    Search,
    Sun,
    TriangleAlert,
    User,
    X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFactory } from '../../context/FactoryContext'
import { NavigationContext } from '../../context/NavigationContext'
import {
    deleteMaintenanceWorkOrder,
    fetchMaintenanceOverview,
    patchMaintenanceWorkOrder,
} from '../../services/maintenanceService'
import { simulationError, simulationService } from '../../services/simulationService'
import type {
    MaintenanceAttentionMachine,
    MaintenanceOverview,
    MaintenanceWorkOrder,
    PatchMaintenanceWorkOrderPayload,
    ResolvedWindow,
    WorkOrderStatus,
    WorkOrderStatusFilter,
    WorkOrderType,
} from '../../types/maintenance'
import { telemetryTimestamp } from '../../utils/telemetrySeries'
import Select from '../common/Select'
import {
    initialsFromName,
    shortHallPillName,
    statusColorToken,
} from '../live_dashboard/operations/operationsHelpers'
import CreateWorkOrderModal from './CreateWorkOrderModal'
import WorkOrderDetailDrawer from './WorkOrderDetailDrawer'
import '../live_dashboard/operations/operations-dashboard.css'

const THEME_STORAGE_KEY = 'sf-operations-theme'
const COUNT_CAP = 9999

const AVATAR_PALETTE = [
    '#2563eb',
    '#7c3aed',
    '#0d9488',
    '#d97706',
    '#db2777',
    '#0284c7',
]

function avatarColorFor(name: string | null | undefined): string {
    if (!name) return '#64748b'
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatCappedCount(count: number): { label: string; exactTitle?: string } {
    if (count > COUNT_CAP) {
        return { label: `${COUNT_CAP}+`, exactTitle: `${count.toLocaleString('en-GB')} work orders` }
    }
    return {
        label: String(count),
        exactTitle: count >= 1000 ? `${count.toLocaleString('en-GB')} work orders` : undefined,
    }
}

function formatDueChip(wo: MaintenanceWorkOrder, nowMs: number): { text: string; tone: 'overdue' | 'today' | 'normal' } {
    if (!wo.dueDateUtc) return { text: 'No date', tone: 'normal' }
    const dueMs = telemetryTimestamp(wo.dueDateUtc)
    const diffHours = (dueMs - nowMs) / 3_600_000
    if (diffHours < 0) {
        const hrs = Math.round(Math.abs(diffHours))
        if (hrs < 48) return { text: `Overdue ${Math.max(1, hrs)}h`, tone: 'overdue' }
        return { text: `Overdue ${Math.ceil(hrs / 24)}d`, tone: 'overdue' }
    }
    if (diffHours < 24) {
        return { text: 'Today', tone: 'today' }
    }
    return {
        text: new Date(dueMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        tone: 'normal',
    }
}

function formatClosedAt(wo: MaintenanceWorkOrder): string {
    const ref = wo.resolvedAtUtc ?? wo.createdAtUtc
    const ts = telemetryTimestamp(ref)
    if (!Number.isFinite(ts)) return ''
    return new Date(ts).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const RESOLVED_WINDOW_OPTIONS: { value: ResolvedWindow; label: string }[] = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: 'all', label: 'All' },
]

export default function MaintenancePage() {
    const { user } = useAuth()
    const { halls, selectedHallId, setSelectedHallId, isLoadingHalls } = useFactory()
    const navigation = useContext(NavigationContext)

    const isSuperAdmin = user?.role === 'SuperAdmin'
    const canManageMachines = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin'

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return stored === 'dark' ? 'dark' : 'light'
    })

    // Kanban Board is the default primary view (matching original mockup), with optional List fallback
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
    const [quickFilter, setQuickFilter] = useState<'none' | 'critical' | 'overdue' | 'today'>('none')
    const [listStatusFilter, setListStatusFilter] = useState<WorkOrderStatusFilter>('All')
    const [typeFilter, setTypeFilter] = useState<WorkOrderType | 'All'>('All')
    const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
    const [resolvedRange, setResolvedRange] = useState<ResolvedWindow>('7d')
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)

    const [data, setData] = useState<MaintenanceOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [selectedOrder, setSelectedOrder] = useState<MaintenanceWorkOrder | null>(null)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [createDefaultMachineId, setCreateDefaultMachineId] = useState<string | null>(null)
    const [serviceMenuOpen, setServiceMenuOpen] = useState(false)
    const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)
    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<WorkOrderStatus | null>(null)

    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [now, setNow] = useState<number>(() => Date.now())
    const [toast, setToast] = useState<string | null>(null)

    const toastTimerRef = useRef<number | null>(null)
    const serviceMenuRef = useRef<HTMLDivElement>(null)
    const assigneeMenuRef = useRef<HTMLDivElement>(null)

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

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput)
            setPage(1)
        }, 220)
        return () => window.clearTimeout(timer)
    }, [searchInput])

    useEffect(() => {
        const onOutside = (e: MouseEvent) => {
            if (serviceMenuRef.current && !serviceMenuRef.current.contains(e.target as Node)) {
                setServiceMenuOpen(false)
            }
            if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target as Node)) {
                setAssigneeMenuOpen(false)
            }
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setServiceMenuOpen(false)
                setAssigneeMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onOutside)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onOutside)
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
        }
    }, [])

    const handleHallChange = (hallId: string | null) => {
        setSelectedHallId(hallId)
        setAssigneeFilter(null)
        setPage(1)
    }

    const effectivePageSize = viewMode === 'board' ? 100 : 15
    const effectiveStatus: WorkOrderStatusFilter =
        quickFilter === 'overdue'
            ? 'Overdue'
            : quickFilter === 'today'
              ? 'DueToday'
              : viewMode === 'board'
                ? 'All'
                : listStatusFilter
    const effectiveType: WorkOrderType | 'All' =
        quickFilter === 'critical' ? 'Critical' : typeFilter

    const loadOverview = useCallback(
        async (signal?: AbortSignal, silent = false) => {
            if (silent) setRefreshing(true)
            else setLoading(prev => prev || !data)
            try {
                const res = await fetchMaintenanceOverview(
                    {
                        page: viewMode === 'board' ? 1 : page,
                        pageSize: effectivePageSize,
                        factoryHallId: isSuperAdmin ? selectedHallId : null,
                        status: effectiveStatus,
                        type: effectiveType,
                        assignedUserId: assigneeFilter,
                        search: debouncedSearch,
                        resolvedRange,
                    },
                    signal,
                )
                if (signal?.aborted) return
                setData(res)
                setError(null)
                setSelectedOrder(curr =>
                    curr ? res.items.data.find(item => item.id === curr.id) ?? curr : null,
                )
            } catch (err) {
                if (signal?.aborted) return
                setError(simulationError(err))
            } finally {
                if (!signal?.aborted) {
                    setLoading(false)
                    setRefreshing(false)
                }
            }
        },
        [
            viewMode,
            page,
            effectivePageSize,
            isSuperAdmin,
            selectedHallId,
            effectiveStatus,
            effectiveType,
            assigneeFilter,
            debouncedSearch,
            resolvedRange,
        ],
    )

    useEffect(() => {
        const controller = new AbortController()
        void loadOverview(controller.signal, Boolean(data))
        return () => controller.abort()
    }, [loadOverview])

    const handlePatchOrder = async (
        wo: MaintenanceWorkOrder,
        patch: PatchMaintenanceWorkOrderPayload,
        feedback: string,
    ) => {
        setBusyAction(`wo-${wo.id}`)
        const snapshot = data

        // Optimistic update for snappy Kanban transitions
        if (patch.status && data) {
            const nextStatus = patch.status
            setData(prev => {
                if (!prev) return prev
                const nextRows = prev.items.data.map(item =>
                    item.id === wo.id
                        ? {
                              ...item,
                              status: nextStatus,
                              resolvedAtUtc: nextStatus === 'Resolved' ? new Date().toISOString() : null,
                              isOverdue: nextStatus === 'Resolved' ? false : item.isOverdue,
                          }
                        : item,
                )
                return { ...prev, items: { ...prev.items, data: nextRows } }
            })
        }

        try {
            await patchMaintenanceWorkOrder(wo.id, patch)
            setSelectedOrder(curr => {
                if (!curr || curr.id !== wo.id) return curr
                const nextStatus = patch.status ?? curr.status
                const nextAssigneeId = patch.clearAssignee
                    ? null
                    : patch.assignedUserId !== undefined
                      ? patch.assignedUserId
                      : curr.assignedUserId
                const nextAssigneeName = patch.clearAssignee
                    ? null
                    : patch.assignedUserId !== undefined
                      ? data?.assignees.find(a => a.userId === patch.assignedUserId)?.fullName ?? curr.assigneeName
                      : curr.assigneeName
                return {
                    ...curr,
                    status: nextStatus,
                    description: patch.description !== undefined ? patch.description : curr.description,
                    assignedUserId: nextAssigneeId,
                    assigneeName: nextAssigneeName,
                    resolvedAtUtc: nextStatus === 'Resolved' ? new Date().toISOString() : null,
                    isOverdue: nextStatus === 'Resolved' ? false : curr.isOverdue,
                }
            })
            await loadOverview(undefined, true)
            showToast(feedback)
        } catch (err) {
            if (snapshot) setData(snapshot)
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const handleDeleteOrder = async (wo: MaintenanceWorkOrder) => {
        setBusyAction(`del-${wo.id}`)
        try {
            await deleteMaintenanceWorkOrder(wo.id)
            setSelectedOrder(null)
            await loadOverview(undefined, true)
            showToast(`Deleted ${wo.ticketNumber}`)
        } catch (err) {
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const handleCompleteMachineRepair = async (machine: MaintenanceAttentionMachine) => {
        setBusyAction(`repair-${machine.machineId}`)
        try {
            await simulationService.action(machine.machineId, 'repair', true)
            if (machine.telemetrySource !== 'RealDevice') {
                await simulationService.action(machine.machineId, 'start', true)
            }
            await loadOverview(undefined, true)
            showToast(
                machine.telemetrySource === 'RealDevice'
                    ? `${machine.machineName} repair completed — awaiting telemetry`
                    : `${machine.machineName} repaired and started online`,
            )
        } catch (err) {
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const openCreateModal = (machineId: string | null = null) => {
        setServiceMenuOpen(false)
        setCreateDefaultMachineId(machineId)
        setCreateModalOpen(true)
    }

    // HTML5 Drag & Drop handlers for Kanban columns
    const handleDragStart = (e: React.DragEvent, wo: MaintenanceWorkOrder) => {
        e.dataTransfer.setData('text/plain', wo.id)
        e.dataTransfer.effectAllowed = 'move'
        setDraggedOrderId(wo.id)
    }

    const handleDragEnd = () => {
        setDraggedOrderId(null)
        setDragOverColumn(null)
    }

    const handleColumnDrop = (e: React.DragEvent, targetStatus: WorkOrderStatus) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain') || draggedOrderId
        setDraggedOrderId(null)
        setDragOverColumn(null)
        if (!id || !data) return
        const order = data.items.data.find(item => item.id === id)
        if (!order || order.status === targetStatus) return
        const label =
            targetStatus === 'InProgress'
                ? 'In Progress'
                : targetStatus === 'Review'
                  ? 'Review & Test'
                  : targetStatus
        void handlePatchOrder(order, { status: targetStatus }, `${order.ticketNumber} → ${label}`)
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
    const assignees = data?.assignees ?? []
    const attentionMachines = data?.attentionMachines ?? []
    const selectedAssigneeObj = assignees.find(a => a.userId === assigneeFilter) ?? null

    const kanbanColumns: {
        status: WorkOrderStatus
        title: string
        headerBg: string
        headerBorder: string
        titleColor: string
        badgeBg: string
        badgeColor: string
        orders: MaintenanceWorkOrder[]
        mutedColumn?: boolean
    }[] = [
        {
            status: 'Open',
            title: 'Open',
            headerBg: 'var(--sf-surface-2)',
            headerBorder: 'var(--sf-border)',
            titleColor: 'var(--sf-text)',
            badgeBg: 'var(--sf-border)',
            badgeColor: 'var(--sf-text-2)',
            orders: items.filter(w => w.status === 'Open'),
        },
        {
            status: 'InProgress',
            title: 'In Progress',
            headerBg: 'rgba(37, 99, 235, 0.08)',
            headerBorder: 'rgba(37, 99, 235, 0.22)',
            titleColor: 'var(--sf-accent)',
            badgeBg: 'rgba(37, 99, 235, 0.16)',
            badgeColor: 'var(--sf-accent)',
            orders: items.filter(w => w.status === 'InProgress'),
        },
        {
            status: 'Review',
            title: 'Review & Test',
            headerBg: 'rgba(147, 51, 234, 0.08)',
            headerBorder: 'rgba(147, 51, 234, 0.24)',
            titleColor: theme === 'dark' ? '#c084fc' : '#6b21a8',
            badgeBg: 'rgba(147, 51, 234, 0.16)',
            badgeColor: theme === 'dark' ? '#d8b4fe' : '#6b21a8',
            orders: items.filter(w => w.status === 'Review'),
        },
        {
            status: 'Resolved',
            title: 'Resolved',
            headerBg: 'rgba(16, 185, 129, 0.08)',
            headerBorder: 'rgba(16, 185, 129, 0.24)',
            titleColor: 'var(--sf-running)',
            badgeBg: 'rgba(16, 185, 129, 0.16)',
            badgeColor: 'var(--sf-running)',
            orders: items.filter(w => w.status === 'Resolved'),
            mutedColumn: true,
        },
    ]

    const startIdx = totalCount === 0 ? 0 : (page - 1) * effectivePageSize + 1
    const endIdx = Math.min(page * effectivePageSize, totalCount)

    return (
        <div className="sf-ops-root flex flex-col min-h-full relative" data-theme={theme}>
            {/* Sticky Header consistent with Live Operations, Machine Fleet & Incident History */}
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
                        Maintenance
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
                        onClick={() => openCreateModal(null)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Work Order</span>
                    </button>

                    <button
                        type="button"
                        disabled={refreshing}
                        onClick={() => void loadOverview(undefined, true)}
                        className="inline-flex items-center justify-center p-2 rounded-xl border cursor-pointer transition-all disabled:opacity-50"
                        style={{
                            background: 'var(--sf-surface)',
                            borderColor: 'var(--sf-border)',
                            color: 'var(--sf-text-2)',
                        }}
                        aria-label="Refresh board"
                        title="Refresh board"
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
            <div className="p-3 sm:p-4 md:px-6 space-y-3.5 w-full flex-1 flex flex-col min-h-0">
                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border px-4 py-3 flex items-center gap-2.5 text-xs shrink-0"
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
                            onClick={() => void loadOverview(undefined, true)}
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
                        <span>Loading work orders board…</span>
                    </div>
                ) : (
                    <>
                        {/* Mockup-style Compact Status Indicators & Filter Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                            {/* Left: Clickable status dots (Critical / Overdue / Scheduled Today / Units in Service) */}
                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickFilter(curr => (curr === 'critical' ? 'none' : 'critical'))
                                        setPage(1)
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                                    style={{
                                        background:
                                            quickFilter === 'critical' ? 'var(--sf-error-bg)' : 'var(--sf-surface)',
                                        borderColor:
                                            quickFilter === 'critical' ? 'var(--sf-error)' : 'var(--sf-border)',
                                        color: quickFilter === 'critical' ? 'var(--sf-error)' : 'var(--sf-text-2)',
                                    }}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                    <span className="sf-ops-num font-bold">{summary?.criticalOpen ?? 0}</span>
                                    <span>Critical</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickFilter(curr => (curr === 'overdue' ? 'none' : 'overdue'))
                                        setPage(1)
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                                    style={{
                                        background:
                                            quickFilter === 'overdue' ? 'var(--sf-warning-bg)' : 'var(--sf-surface)',
                                        borderColor:
                                            quickFilter === 'overdue' ? 'var(--sf-warning)' : 'var(--sf-border)',
                                        color: quickFilter === 'overdue' ? 'var(--sf-warning)' : 'var(--sf-text-2)',
                                    }}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                    <span className="sf-ops-num font-bold">{summary?.overdue ?? 0}</span>
                                    <span>Overdue</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickFilter(curr => (curr === 'today' ? 'none' : 'today'))
                                        setPage(1)
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                                    style={{
                                        background:
                                            quickFilter === 'today' ? 'var(--sf-accent-soft)' : 'var(--sf-surface)',
                                        borderColor:
                                            quickFilter === 'today' ? 'var(--sf-accent)' : 'var(--sf-border)',
                                        color: quickFilter === 'today' ? 'var(--sf-accent)' : 'var(--sf-text-2)',
                                    }}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                    <span className="sf-ops-num font-bold">{summary?.scheduledToday ?? 0}</span>
                                    <span>Scheduled Today</span>
                                </button>

                                {/* Compact dropdown for machines currently in Maintenance / Error */}
                                {attentionMachines.length > 0 && (
                                    <div className="relative" ref={serviceMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => setServiceMenuOpen(open => !open)}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                                            style={{
                                                background: serviceMenuOpen ? 'var(--sf-maint-bg)' : 'var(--sf-surface)',
                                                borderColor: serviceMenuOpen ? 'var(--sf-maint)' : 'var(--sf-border)',
                                                color: 'var(--sf-text-2)',
                                            }}
                                        >
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ background: 'var(--sf-maint)' }}
                                            />
                                            <span className="sf-ops-num font-bold">{attentionMachines.length}</span>
                                            <span>Units in Service</span>
                                            <ChevronDown
                                                className={`w-3.5 h-3.5 transition-transform ${serviceMenuOpen ? 'rotate-180' : ''}`}
                                                style={{ color: 'var(--sf-muted)' }}
                                            />
                                        </button>

                                        {serviceMenuOpen && (
                                            <div
                                                className="absolute left-0 mt-1.5 w-80 rounded-2xl border shadow-2xl p-2 z-30 space-y-1.5"
                                                style={{
                                                    background: 'var(--sf-surface)',
                                                    borderColor: 'var(--sf-border-strong)',
                                                }}
                                            >
                                                <div
                                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
                                                    style={{ color: 'var(--sf-muted)' }}
                                                >
                                                    <span>Machines in Maintenance / Error</span>
                                                    <span className="sf-ops-num">{attentionMachines.length}</span>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto sf-ops-scroll space-y-1">
                                                    {attentionMachines.map(m => {
                                                        const dotColor = statusColorToken(m.status)
                                                        const isRepairBusy = busyAction === `repair-${m.machineId}`
                                                        return (
                                                            <div
                                                                key={m.machineId}
                                                                className="rounded-xl px-2.5 py-2 border flex items-center justify-between gap-2"
                                                                style={{
                                                                    background: 'var(--sf-surface-2)',
                                                                    borderColor: 'var(--sf-border)',
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span
                                                                        className="w-2 h-2 rounded-full shrink-0"
                                                                        style={{ background: dotColor }}
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-semibold truncate">
                                                                            {m.machineName}
                                                                        </div>
                                                                        <div
                                                                            className="text-[10.5px] truncate"
                                                                            style={{ color: 'var(--sf-muted)' }}
                                                                        >
                                                                            {m.status} · {m.productionLineName ?? 'Utility'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {m.status === 'Maintenance' && canManageMachines ? (
                                                                    <button
                                                                        type="button"
                                                                        disabled={isRepairBusy}
                                                                        onClick={() => void handleCompleteMachineRepair(m)}
                                                                        className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shrink-0 disabled:opacity-50"
                                                                    >
                                                                        {isRepairBusy ? '…' : 'Complete'}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openCreateModal(m.machineId)}
                                                                        className="px-2 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer shrink-0"
                                                                        style={{
                                                                            background: 'var(--sf-surface)',
                                                                            borderColor: 'var(--sf-border-strong)',
                                                                            color: 'var(--sf-text)',
                                                                        }}
                                                                    >
                                                                        + Ticket
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Compact Assignee dropdown + Search + Board/List toggle */}
                            <div className="flex items-center flex-wrap gap-2">
                                {/* Assignee filter dropdown */}
                                <div className="relative" ref={assigneeMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setAssigneeMenuOpen(open => !open)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors"
                                        style={{
                                            background: assigneeFilter ? 'var(--sf-accent-soft)' : 'var(--sf-surface)',
                                            borderColor: assigneeFilter ? 'var(--sf-accent)' : 'var(--sf-border)',
                                            color: assigneeFilter ? 'var(--sf-accent)' : 'var(--sf-text-2)',
                                        }}
                                    >
                                        <User className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate max-w-[140px]">
                                            {selectedAssigneeObj ? selectedAssigneeObj.fullName : 'All Technicians'}
                                        </span>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 transition-transform ${assigneeMenuOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {assigneeMenuOpen && (
                                        <div
                                            className="absolute right-0 mt-1.5 w-56 rounded-xl border shadow-xl p-1 z-30"
                                            style={{
                                                background: 'var(--sf-surface)',
                                                borderColor: 'var(--sf-border-strong)',
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAssigneeFilter(null)
                                                    setAssigneeMenuOpen(false)
                                                    setPage(1)
                                                }}
                                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                                                style={{
                                                    background: !assigneeFilter ? 'var(--sf-accent-soft)' : 'transparent',
                                                    color: !assigneeFilter ? 'var(--sf-accent)' : 'var(--sf-text)',
                                                }}
                                            >
                                                <span>All Technicians</span>
                                                {!assigneeFilter && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                            {assignees.map(a => {
                                                const active = assigneeFilter === a.userId
                                                return (
                                                    <button
                                                        key={a.userId}
                                                        type="button"
                                                        onClick={() => {
                                                            setAssigneeFilter(a.userId)
                                                            setAssigneeMenuOpen(false)
                                                            setPage(1)
                                                        }}
                                                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                                                        style={{
                                                            background: active ? 'var(--sf-accent-soft)' : 'transparent',
                                                            color: active ? 'var(--sf-accent)' : 'var(--sf-text)',
                                                        }}
                                                    >
                                                        <span className="truncate">
                                                            {a.fullName}
                                                            {a.userId === user?.id ? ' (You)' : ''}
                                                        </span>
                                                        <span
                                                            className="sf-ops-num text-[10.5px] shrink-0"
                                                            style={{ color: 'var(--sf-muted)' }}
                                                        >
                                                            {a.activeWorkOrdersCount}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Search */}
                                <div className="relative w-48 sm:w-56">
                                    <Search
                                        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--sf-muted)' }}
                                    />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={e => setSearchInput(e.target.value)}
                                        placeholder="Search ticket, machine…"
                                        className="w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs outline-none"
                                        style={{
                                            background: 'var(--sf-surface)',
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

                                {/* Board / List toggle */}
                                <div
                                    className="inline-flex items-center p-0.5 rounded-xl border gap-0.5"
                                    style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                    role="group"
                                    aria-label="Switch layout"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('board')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                                        style={
                                            viewMode === 'board'
                                                ? {
                                                      background: 'var(--sf-surface)',
                                                      color: 'var(--sf-accent)',
                                                      boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                                  }
                                                : { color: 'var(--sf-muted)' }
                                        }
                                    >
                                        <Kanban className="w-3.5 h-3.5" />
                                        <span>Board</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                                        style={
                                            viewMode === 'list'
                                                ? {
                                                      background: 'var(--sf-surface)',
                                                      color: 'var(--sf-accent)',
                                                      boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                                  }
                                                : { color: 'var(--sf-muted)' }
                                        }
                                    >
                                        <List className="w-3.5 h-3.5" />
                                        <span>List</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {viewMode === 'board' ? (
                            /* 4-COLUMN KANBAN BOARD (matching original maintance.html mockup + real Drag & Drop) */
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start flex-1 min-h-0">
                                {kanbanColumns.map(col => {
                                    const isDropTarget = dragOverColumn === col.status
                                    const colCount = formatCappedCount(col.orders.length)
                                    return (
                                        <section
                                            key={col.status}
                                            onDragOver={e => {
                                                e.preventDefault()
                                                e.dataTransfer.dropEffect = 'move'
                                                if (dragOverColumn !== col.status) setDragOverColumn(col.status)
                                            }}
                                            onDragLeave={e => {
                                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                    setDragOverColumn(curr => (curr === col.status ? null : curr))
                                                }
                                            }}
                                            onDrop={e => handleColumnDrop(e, col.status)}
                                            className="flex flex-col rounded-2xl border shadow-xs transition-all xl:max-h-[calc(100vh-192px)] overflow-hidden"
                                            style={{
                                                background: 'var(--sf-surface-2)',
                                                borderColor: isDropTarget ? 'var(--sf-accent)' : 'var(--sf-border)',
                                                boxShadow: isDropTarget
                                                    ? '0 0 0 2px color-mix(in srgb, var(--sf-accent) 35%, transparent)'
                                                    : undefined,
                                                opacity: col.mutedColumn && !isDropTarget ? 0.88 : 1,
                                            }}
                                            aria-label={`${col.title} column`}
                                        >
                                            {/* Column Header */}
                                            <div
                                                className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0"
                                                style={{
                                                    background: col.headerBg,
                                                    borderColor: col.headerBorder,
                                                }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <h2
                                                        className="text-xs font-extrabold uppercase tracking-wider truncate"
                                                        style={{ color: col.titleColor }}
                                                    >
                                                        {col.title}
                                                    </h2>
                                                    <span
                                                        className="sf-ops-num text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                                        style={{ background: col.badgeBg, color: col.badgeColor }}
                                                        title={colCount.exactTitle}
                                                    >
                                                        {colCount.label}
                                                    </span>
                                                </div>

                                                {col.status === 'Open' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openCreateModal(null)}
                                                        className="p-1 rounded-lg hover:bg-slate-500/10 cursor-pointer transition-colors"
                                                        style={{ color: 'var(--sf-muted)' }}
                                                        title="Create work order"
                                                        aria-label="Create work order"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {col.status === 'Resolved' && (
                                                    <div
                                                        className="inline-flex items-center rounded-lg p-0.5 gap-0.5"
                                                        style={{ background: 'color-mix(in srgb, var(--sf-surface) 65%, transparent)' }}
                                                        role="group"
                                                        aria-label="Resolved window"
                                                    >
                                                        {RESOLVED_WINDOW_OPTIONS.map(opt => {
                                                            const active = resolvedRange === opt.value
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setResolvedRange(opt.value)}
                                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                                                    style={
                                                                        active
                                                                            ? {
                                                                                  background: 'var(--sf-surface)',
                                                                                  color: 'var(--sf-running)',
                                                                              }
                                                                            : { color: 'var(--sf-muted)' }
                                                                    }
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cards List */}
                                            <div className="p-3 overflow-y-auto sf-ops-scroll space-y-2.5 flex-1 min-h-[140px]">
                                                {col.orders.length === 0 ? (
                                                    <div
                                                        className="rounded-xl border border-dashed py-8 px-3 text-center text-xs"
                                                        style={{
                                                            borderColor: isDropTarget
                                                                ? 'var(--sf-accent)'
                                                                : 'var(--sf-border-strong)',
                                                            color: isDropTarget ? 'var(--sf-accent)' : 'var(--sf-muted)',
                                                        }}
                                                    >
                                                        {isDropTarget ? 'Drop card here' : 'No work orders'}
                                                    </div>
                                                ) : (
                                                    col.orders.map(wo => {
                                                        const isDragging = draggedOrderId === wo.id
                                                        const isSelected = selectedOrder?.id === wo.id

                                                        // Compact Resolved card (directly inspired by maintance.html lines 226-232)
                                                        if (col.status === 'Resolved') {
                                                            return (
                                                                <article
                                                                    key={wo.id}
                                                                    draggable
                                                                    onDragStart={e => handleDragStart(e, wo)}
                                                                    onDragEnd={handleDragEnd}
                                                                    onClick={() => setSelectedOrder(wo)}
                                                                    className="rounded-xl border p-3.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
                                                                    style={{
                                                                        background: 'var(--sf-surface)',
                                                                        borderColor: isSelected
                                                                            ? 'var(--sf-accent)'
                                                                            : 'var(--sf-border)',
                                                                        opacity: isDragging ? 0.45 : 0.9,
                                                                    }}
                                                                >
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <h3 className="text-xs font-bold leading-snug line-through opacity-80">
                                                                            {wo.title}
                                                                        </h3>
                                                                        <CheckCircle2
                                                                            className="w-4 h-4 shrink-0 mt-0.5"
                                                                            style={{ color: 'var(--sf-running)' }}
                                                                        />
                                                                    </div>
                                                                    <div
                                                                        className="text-[11px] mt-1 truncate"
                                                                        style={{ color: 'var(--sf-muted)' }}
                                                                    >
                                                                        {wo.machineName}
                                                                    </div>
                                                                    <div
                                                                        className="text-[10.5px] sf-ops-num mt-1.5"
                                                                        style={{ color: 'var(--sf-muted)' }}
                                                                    >
                                                                        Closed{wo.assigneeName ? ` · ${wo.assigneeName}` : ''} ·{' '}
                                                                        {formatClosedAt(wo)}
                                                                    </div>
                                                                </article>
                                                            )
                                                        }

                                                        const isCritical = wo.type === 'Critical'
                                                        const isPredictive = wo.type === 'Predictive'
                                                        const leftStripe = isCritical
                                                            ? '#ef4444'
                                                            : isPredictive
                                                              ? '#f59e0b'
                                                              : null
                                                        const badgeStyle = isCritical
                                                            ? { bg: 'var(--sf-error-bg)', fg: 'var(--sf-error)' }
                                                            : isPredictive
                                                              ? { bg: 'var(--sf-accent-soft)', fg: 'var(--sf-accent)' }
                                                              : { bg: 'var(--sf-surface-2)', fg: 'var(--sf-muted)' }
                                                        const due = formatDueChip(wo, now)

                                                        return (
                                                            <article
                                                                key={wo.id}
                                                                draggable
                                                                onDragStart={e => handleDragStart(e, wo)}
                                                                onDragEnd={handleDragEnd}
                                                                onClick={() => setSelectedOrder(wo)}
                                                                className="rounded-xl border p-3.5 shadow-2xs cursor-grab active:cursor-grabbing transition-all hover:shadow-md relative overflow-hidden"
                                                                style={{
                                                                    background: 'var(--sf-surface)',
                                                                    borderColor: isSelected
                                                                        ? 'var(--sf-accent)'
                                                                        : isCritical
                                                                          ? 'color-mix(in srgb, var(--sf-error) 35%, var(--sf-border))'
                                                                          : 'var(--sf-border)',
                                                                    opacity: isDragging ? 0.45 : 1,
                                                                }}
                                                            >
                                                                {leftStripe && (
                                                                    <div
                                                                        className="absolute top-0 left-0 w-1 h-full"
                                                                        style={{ background: leftStripe }}
                                                                    />
                                                                )}

                                                                <div className={leftStripe ? 'pl-1.5' : ''}>
                                                                    {/* Type badge & Ticket number */}
                                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                                        <span
                                                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                                                                            style={{
                                                                                background: badgeStyle.bg,
                                                                                color: badgeStyle.fg,
                                                                            }}
                                                                        >
                                                                            {isCritical && (
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                                            )}
                                                                            {wo.type}
                                                                        </span>
                                                                        <span
                                                                            className="sf-ops-num text-[10.5px] truncate"
                                                                            style={{ color: 'var(--sf-muted)' }}
                                                                        >
                                                                            #{wo.ticketNumber}
                                                                        </span>
                                                                    </div>

                                                                    {/* Title & Machine */}
                                                                    <h3 className="text-[13px] font-bold leading-snug">
                                                                        {wo.title}
                                                                    </h3>
                                                                    <div
                                                                        className="flex items-center gap-1 text-[11px] font-medium mt-1 truncate"
                                                                        style={{ color: 'var(--sf-text-2)' }}
                                                                    >
                                                                        <Cpu
                                                                            className="w-3 h-3 shrink-0"
                                                                            style={{ color: 'var(--sf-muted)' }}
                                                                        />
                                                                        <span className="truncate">
                                                                            {wo.machineName}
                                                                            {showingAllHalls
                                                                                ? ` · ${shortHallPillName(wo.factoryHallName)}`
                                                                                : ''}
                                                                        </span>
                                                                    </div>

                                                                    {/* Short Description */}
                                                                    {wo.description && (
                                                                        <p
                                                                            className="text-[11.5px] mt-1.5 line-clamp-2 leading-relaxed"
                                                                            style={{ color: 'var(--sf-muted)' }}
                                                                        >
                                                                            {wo.description}
                                                                        </p>
                                                                    )}

                                                                    {/* Card Footer: Assignee + Due / QA Badge */}
                                                                    <div
                                                                        className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t"
                                                                        style={{ borderColor: 'var(--sf-border)' }}
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            {wo.assigneeName ? (
                                                                                <span
                                                                                    className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                                                                                    style={{
                                                                                        background: avatarColorFor(
                                                                                            wo.assigneeName,
                                                                                        ),
                                                                                    }}
                                                                                    title={wo.assigneeName}
                                                                                >
                                                                                    {initialsFromName(wo.assigneeName)}
                                                                                </span>
                                                                            ) : (
                                                                                <span
                                                                                    className="w-6 h-6 rounded-full border border-dashed text-[11px] font-bold flex items-center justify-center shrink-0"
                                                                                    style={{
                                                                                        borderColor:
                                                                                            'var(--sf-border-strong)',
                                                                                        color: 'var(--sf-muted)',
                                                                                    }}
                                                                                    title="Unassigned"
                                                                                >
                                                                                    ?
                                                                                </span>
                                                                            )}
                                                                            {col.status === 'InProgress' ? (
                                                                                <span
                                                                                    className="text-[10.5px] font-bold truncate"
                                                                                    style={{ color: 'var(--sf-accent)' }}
                                                                                >
                                                                                    Working…
                                                                                </span>
                                                                            ) : (
                                                                                wo.assigneeName && (
                                                                                    <span
                                                                                        className="text-[11px] truncate"
                                                                                        style={{ color: 'var(--sf-muted)' }}
                                                                                    >
                                                                                        {wo.assigneeName.split(' ')[0]}
                                                                                    </span>
                                                                                )
                                                                            )}
                                                                        </div>

                                                                        {col.status === 'Review' ? (
                                                                            <span
                                                                                className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                                                                                style={{
                                                                                    background: 'rgba(147, 51, 234, 0.12)',
                                                                                    color:
                                                                                        theme === 'dark'
                                                                                            ? '#d8b4fe'
                                                                                            : '#7e22ce',
                                                                                }}
                                                                            >
                                                                                Awaiting QA
                                                                            </span>
                                                                        ) : (
                                                                            <span
                                                                                className="inline-flex items-center gap-1 sf-ops-num text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0"
                                                                                style={
                                                                                    due.tone === 'overdue'
                                                                                        ? {
                                                                                              background:
                                                                                                  'var(--sf-error-bg)',
                                                                                              color: 'var(--sf-error)',
                                                                                          }
                                                                                        : due.tone === 'today'
                                                                                          ? {
                                                                                                background:
                                                                                                    'var(--sf-warning-bg)',
                                                                                                color: 'var(--sf-warning)',
                                                                                            }
                                                                                          : {
                                                                                                background:
                                                                                                    'var(--sf-surface-2)',
                                                                                                color: 'var(--sf-muted)',
                                                                                            }
                                                                                }
                                                                            >
                                                                                <Calendar className="w-3 h-3 shrink-0" />
                                                                                <span>{due.text}</span>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </section>
                                    )
                                })}
                            </div>
                        ) : (
                            /* Compact Paginated List View (optional secondary view) */
                            <section className="sf-ops-card overflow-hidden">
                                <div
                                    className="px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2"
                                    style={{ borderColor: 'var(--sf-border)' }}
                                >
                                    <div
                                        className="inline-flex items-center p-0.5 rounded-xl border gap-0.5"
                                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                    >
                                        {(
                                            [
                                                { value: 'All', label: 'All', count: summary?.total },
                                                { value: 'Open', label: 'Open', count: summary?.open },
                                                { value: 'InProgress', label: 'In Progress', count: summary?.inProgress },
                                                { value: 'Review', label: 'Review', count: summary?.review },
                                                { value: 'Resolved', label: 'Resolved', count: summary?.resolved },
                                            ] as { value: WorkOrderStatusFilter; label: string; count?: number }[]
                                        ).map(tab => {
                                            const active = listStatusFilter === tab.value && quickFilter === 'none'
                                            const fmt = tab.count !== undefined ? formatCappedCount(tab.count) : null
                                            return (
                                                <button
                                                    key={tab.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuickFilter('none')
                                                        setListStatusFilter(tab.value)
                                                        setPage(1)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
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
                                                    {fmt && (
                                                        <span className="sf-ops-num text-[10.5px] opacity-75">
                                                            {fmt.label}
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div
                                        className="inline-flex items-center p-0.5 rounded-xl border gap-0.5"
                                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                                    >
                                        {(['All', 'Critical', 'Predictive', 'Routine'] as const).map(t => {
                                            const active = typeFilter === t
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        setTypeFilter(t)
                                                        setPage(1)
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                                                    style={
                                                        active
                                                            ? {
                                                                  background: 'var(--sf-surface)',
                                                                  color: 'var(--sf-text)',
                                                                  boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                                              }
                                                            : { color: 'var(--sf-muted)' }
                                                    }
                                                >
                                                    {t}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

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
                                                <th className="py-2.5 pl-4 pr-3">Work Order</th>
                                                <th className="py-2.5 px-3">Asset</th>
                                                <th className="py-2.5 px-3">Assignee</th>
                                                <th className="py-2.5 px-3">Due</th>
                                                <th className="py-2.5 pl-3 pr-4 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className="py-12 text-center text-xs"
                                                        style={{ color: 'var(--sf-muted)' }}
                                                    >
                                                        No work orders match the current filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                items.map(wo => {
                                                    const due = formatDueChip(wo, now)
                                                    const isResolved = wo.status === 'Resolved'
                                                    const isRowBusy = busyAction === `wo-${wo.id}`
                                                    return (
                                                        <tr
                                                            key={wo.id}
                                                            onClick={() => setSelectedOrder(wo)}
                                                            className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-slate-500/[0.05]"
                                                            style={{
                                                                borderColor: 'var(--sf-border)',
                                                                opacity: isResolved ? 0.72 : 1,
                                                            }}
                                                        >
                                                            <td className="py-3 pl-4 pr-3 max-w-[360px]">
                                                                <div className="text-xs font-semibold truncate">
                                                                    {wo.title}
                                                                </div>
                                                                <div
                                                                    className="sf-ops-num text-[11px]"
                                                                    style={{ color: 'var(--sf-muted)' }}
                                                                >
                                                                    #{wo.ticketNumber} · {wo.type}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-xs font-medium">
                                                                {wo.machineName}
                                                            </td>
                                                            <td className="py-3 px-3 text-xs">
                                                                {wo.assigneeName ?? (
                                                                    <span style={{ color: 'var(--sf-muted)' }}>
                                                                        Unassigned
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 sf-ops-num text-xs">
                                                                <span
                                                                    style={{
                                                                        color:
                                                                            due.tone === 'overdue' && !isResolved
                                                                                ? 'var(--sf-error)'
                                                                                : 'var(--sf-muted)',
                                                                    }}
                                                                >
                                                                    {isResolved ? formatClosedAt(wo) : due.text}
                                                                </span>
                                                            </td>
                                                            <td
                                                                className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <div className="inline-flex items-center gap-2">
                                                                    <span
                                                                        className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                                                                        style={{
                                                                            background: isResolved
                                                                                ? 'var(--sf-running-bg)'
                                                                                : wo.status === 'Review'
                                                                                  ? 'rgba(147, 51, 234, 0.14)'
                                                                                  : wo.status === 'InProgress'
                                                                                    ? 'var(--sf-accent-soft)'
                                                                                    : 'var(--sf-surface-2)',
                                                                            color: isResolved
                                                                                ? 'var(--sf-running)'
                                                                                : wo.status === 'Review'
                                                                                  ? '#9333ea'
                                                                                  : wo.status === 'InProgress'
                                                                                    ? 'var(--sf-accent)'
                                                                                    : 'var(--sf-text-2)',
                                                                        }}
                                                                    >
                                                                        {wo.status === 'InProgress'
                                                                            ? 'In Progress'
                                                                            : wo.status === 'Review'
                                                                              ? 'Review & Test'
                                                                              : wo.status}
                                                                    </span>
                                                                    {wo.status === 'Open' && (
                                                                        <button
                                                                            type="button"
                                                                            disabled={isRowBusy}
                                                                            onClick={() =>
                                                                                void handlePatchOrder(
                                                                                    wo,
                                                                                    { status: 'InProgress' },
                                                                                    `${wo.ticketNumber} started`,
                                                                                )
                                                                            }
                                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer disabled:opacity-50"
                                                                            style={{
                                                                                borderColor: 'var(--sf-border-strong)',
                                                                                color: 'var(--sf-text)',
                                                                            }}
                                                                        >
                                                                            <Play className="w-3 h-3" />
                                                                            <span>Start</span>
                                                                        </button>
                                                                    )}
                                                                    {(wo.status === 'InProgress' || wo.status === 'Review') && (
                                                                        <button
                                                                            type="button"
                                                                            disabled={isRowBusy}
                                                                            onClick={() =>
                                                                                void handlePatchOrder(
                                                                                    wo,
                                                                                    {
                                                                                        status:
                                                                                            wo.status === 'InProgress'
                                                                                                ? 'Review'
                                                                                                : 'Resolved',
                                                                                    },
                                                                                    wo.status === 'InProgress'
                                                                                        ? `${wo.ticketNumber} → Review`
                                                                                        : `${wo.ticketNumber} resolved`,
                                                                                )
                                                                            }
                                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                                                                        >
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            <span>
                                                                                {wo.status === 'InProgress'
                                                                                    ? 'Review'
                                                                                    : 'Resolve'}
                                                                            </span>
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

                                <div
                                    className="px-4 py-2.5 border-t flex items-center justify-between text-xs"
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
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer disabled:opacity-40"
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
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer disabled:opacity-40"
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
                        )}
                    </>
                )}

                {/* Subtle Footer */}
                <footer
                    className="flex flex-wrap items-center justify-between gap-2 pt-0.5 pb-1 px-1 text-[11px] shrink-0"
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
                    {viewMode === 'board' && (
                        <span className="hidden sm:inline">Drag cards between columns to update status</span>
                    )}
                </footer>
            </div>

            {/* Slide-Over Detail Drawer */}
            <WorkOrderDetailDrawer
                workOrder={selectedOrder}
                assignees={assignees}
                canManageMachines={canManageMachines}
                busyAction={busyAction}
                onClose={() => setSelectedOrder(null)}
                onPatch={(wo, patch, msg) => void handlePatchOrder(wo, patch, msg)}
                onDelete={wo => void handleDeleteOrder(wo)}
            />

            {/* Create Work Order Modal */}
            <CreateWorkOrderModal
                isOpen={createModalOpen}
                factoryHallId={isSuperAdmin ? selectedHallId : null}
                assignees={assignees}
                canManageMachines={canManageMachines}
                defaultMachineId={createDefaultMachineId}
                onClose={() => setCreateModalOpen(false)}
                onCreated={created => {
                    void loadOverview(undefined, true)
                    showToast(`Created ${created.ticketNumber}`)
                }}
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
