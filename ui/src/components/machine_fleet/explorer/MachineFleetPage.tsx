import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
    Activity,
    Building2,
    Menu,
    Moon,
    Plus,
    Radio,
    Sun,
    TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFactory } from '../../../context/FactoryContext'
import { NavigationContext } from '../../../context/NavigationContext'
import { useLiveDashboard } from '../../../hooks/useLiveDashboard'
import {
    dispatchDashboardWorkOrder,
    updateDashboardIncidentStatus,
    updateDashboardWorkOrderStatus,
} from '../../../services/dashboardService'
import { startLineById } from '../../../services/productionLinesService'
import { simulationError, simulationService } from '../../../services/simulationService'
import type { DashboardMachine, DashboardWorkOrder } from '../../../types/dashboard'
import type { MachineStatus } from '../../../types/machine'
import Select from '../../common/Select'
import AddMachineModal from '../AddMachineModal'
import OperationsSidebarDock, { type OperationsDockTab } from '../../live_dashboard/operations/OperationsSidebarDock'
import {
    machineCode,
    nextWorkOrderStatus,
    shortHallPillName,
} from '../../live_dashboard/operations/operationsHelpers'
import StressRadarExplorer from './StressRadarExplorer'
import '../../live_dashboard/operations/operations-dashboard.css'

const THEME_STORAGE_KEY = 'sf-operations-theme'

export default function MachineFleetPage() {
    const { user } = useAuth()
    const { halls, selectedHallId, setSelectedHallId, isLoadingHalls } = useFactory()
    const navigation = useContext(NavigationContext)

    const isSuperAdmin = user?.role === 'SuperAdmin'
    const canManageMachines = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin'

    const { data, loading, refreshing, error, refresh, connectionStatus } = useLiveDashboard()

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return stored === 'dark' ? 'dark' : 'light'
    })

    const [statusFilter, setStatusFilter] = useState<MachineStatus | 'All'>('All')
    const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
    const [inspectorOpen, setInspectorOpen] = useState(false)
    const [dockTab, setDockTab] = useState<OperationsDockTab>('inspector')
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [now, setNow] = useState<number>(() => Date.now())
    const [toast, setToast] = useState<string | null>(null)
    const [tempHistoryByMachine, setTempHistoryByMachine] = useState<Record<string, number[]>>({})

    const toastTimerRef = useRef<number | null>(null)

    const showToast = (message: string) => {
        setToast(message)
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3600)
    }

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'light' ? 'dark' : 'light'
            localStorage.setItem(THEME_STORAGE_KEY, next)
            return next
        })
    }

    // Keep relative timestamps ticking smoothly
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    // Close inspector drawer on Escape
    useEffect(() => {
        if (!inspectorOpen) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setInspectorOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [inspectorOpen])

    const machines = data?.machines ?? []
    const incidents = data?.incidents ?? []
    const productionLines = data?.productionLines ?? []
    const workOrders = data?.workOrders ?? []
    const thresholds = data?.thresholds ?? []

    // Accumulate rolling live temperature sparklines per machine from real SignalR updates
    const snapshotStamp = data?.generatedAtUtc ?? null
    useEffect(() => {
        if (!machines.length) return
        setTempHistoryByMachine(prev => {
            let changed = false
            const next: Record<string, number[]> = { ...prev }
            for (const m of machines) {
                const temp = m.latestTelemetry?.temperature
                if (temp === null || temp === undefined || !Number.isFinite(temp)) continue
                const existing = prev[m.id] ?? []
                const last = existing[existing.length - 1]
                if (last === undefined || Math.abs(last - temp) >= 0.05 || existing.length < 2) {
                    next[m.id] = [...existing, temp].slice(-14)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [machines, snapshotStamp])

    const activeMachine = useMemo(() => {
        if (!machines.length) return null
        if (selectedMachineId) {
            const found = machines.find(m => m.id === selectedMachineId)
            if (found) return found
        }
        return (
            machines.find(m => m.status === 'Error') ??
            machines.find(m => m.status === 'Warning') ??
            machines[0]
        )
    }, [machines, selectedMachineId])

    const handleHallChange = (hallId: string | null) => {
        setSelectedHallId(hallId)
        setSelectedMachineId(null)
    }

    const handleSelectMachine = (machineId: string) => {
        setSelectedMachineId(machineId)
        setDockTab('inspector')
        setInspectorOpen(true)
    }

    const runAction = async (actionKey: string, task: () => Promise<string | void>) => {
        setBusyAction(actionKey)
        try {
            const feedback = await task()
            await refresh()
            if (feedback) showToast(feedback)
        } catch (err) {
            showToast(simulationError(err))
        } finally {
            setBusyAction(null)
        }
    }

    const recoverMachineToRunning = async (machine: DashboardMachine) => {
        if (machine.status === 'Error' || machine.status === 'Warning') {
            await simulationService.action(machine.id, 'maintenance', true)
            await simulationService.action(machine.id, 'repair', true)
            await simulationService.action(machine.id, 'start', true)
        } else if (machine.status === 'Maintenance') {
            await simulationService.action(machine.id, 'repair', true)
            await simulationService.action(machine.id, 'start', true)
        } else {
            await simulationService.action(machine.id, 'start', true)
        }
    }

    const handleDispatchTech = (machine: DashboardMachine) =>
        void runAction(`dispatch-${machine.id}`, async () => {
            const created = await dispatchDashboardWorkOrder(machine.id)
            return `Dispatched ${created.assigneeName ?? 'technician'} to ${machineCode(machine)} · ${created.ticketNumber}`
        })

    const handleRecoverUnit = (machine: DashboardMachine) =>
        void runAction(`recover-${machine.id}`, async () => {
            const wasOffline = machine.status === 'Offline'
            await recoverMachineToRunning(machine)
            return wasOffline
                ? `${machineCode(machine)} started online`
                : `${machineCode(machine)} repaired and returned to service`
        })

    const handleSetMaintenance = (machine: DashboardMachine) =>
        void runAction(`maint-${machine.id}`, async () => {
            await simulationService.action(machine.id, 'maintenance', true)
            return `${machineCode(machine)} placed in Maintenance`
        })

    const handleRecoverLine = (lineId: string) =>
        void runAction(`line-${lineId}`, async () => {
            const lineStations = machines.filter(m => m.productionLineId === lineId)
            for (const m of lineStations) {
                await recoverMachineToRunning(m)
            }
            await startLineById(lineId)
            return 'Production line recovered and started'
        })

    const handleAcknowledgeIncident = (incidentId: string) =>
        void runAction(`ack-${incidentId}`, async () => {
            await updateDashboardIncidentStatus(incidentId, 'Acknowledged')
            return 'Alert acknowledged'
        })

    const handleResolveIncident = (incidentId: string) =>
        void runAction(`resolve-${incidentId}`, async () => {
            await updateDashboardIncidentStatus(incidentId, 'Resolved')
            return 'Alert marked resolved'
        })

    const handleAdvanceWorkOrder = (workOrder: DashboardWorkOrder) =>
        void runAction(`wo-${workOrder.id}`, async () => {
            const next = nextWorkOrderStatus(workOrder.status)
            await updateDashboardWorkOrderStatus(workOrder.id, next)
            return `${workOrder.ticketNumber} → ${next === 'InProgress' ? 'In Progress' : next}`
        })

    const hallOptions = isSuperAdmin
        ? [{ value: null, label: 'All Factory Halls' }, ...halls.map(h => ({ value: h.id, label: h.name }))]
        : halls.map(h => ({ value: h.id, label: h.name }))

    const assignedHall = halls.find(h => h.id === (selectedHallId ?? user?.factoryHallId))
    const showHallPills = isSuperAdmin && halls.length > 0 && halls.length <= 3

    return (
        <div className="sf-ops-root flex flex-col min-h-full relative" data-theme={theme}>
            {/* Machine Fleet Header */}
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
                    <div className="flex items-center gap-2.5 min-w-0">
                        <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-none truncate">
                            Machine Fleet
                        </h1>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Hall Scope Switcher */}
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
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)', color: 'var(--sf-text-2)' }}
                        >
                            <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--sf-muted)' }} />
                            <span className="truncate max-w-[220px]">{shortHallPillName(assignedHall.name)}</span>
                        </span>
                    ) : null}

                    {/* Add Machine Button (Admins only) */}
                    {canManageMachines && (
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Machine</span>
                        </button>
                    )}

                    {/* Theme Toggle (Icon-only) */}
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

            {/* Main Workspace Body */}
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
                        <span className="flex-1">
                            {error.includes('timeout') ? 'Fleet telemetry refresh timed out.' : error}{' '}
                            {data && 'Showing the latest available snapshot.'}
                        </span>
                        <button
                            type="button"
                            disabled={refreshing}
                            onClick={() => void refresh()}
                            className="font-bold underline cursor-pointer shrink-0 disabled:opacity-50"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!data && loading && (
                    <div className="sf-ops-card p-10 flex items-center justify-center gap-2.5 text-sm" role="status" style={{ color: 'var(--sf-muted)' }}>
                        <Activity className="w-5 h-5 animate-pulse" style={{ color: 'var(--sf-accent)' }} />
                        <span>Loading live machine fleet telemetry…</span>
                    </div>
                )}

                {data && (
                    <StressRadarExplorer
                        scopeKey={selectedHallId ?? 'all'}
                        machines={machines}
                        thresholds={thresholds}
                        workOrders={workOrders}
                        tempHistoryByMachine={tempHistoryByMachine}
                        selectedMachineId={inspectorOpen ? activeMachine?.id ?? null : null}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        onSelectMachine={handleSelectMachine}
                    />
                )}

                {/* Footer */}
                <footer className="flex flex-wrap items-center justify-between gap-2 pt-0.5 pb-2 px-1 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
                    <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5" style={{ color: 'var(--sf-accent)' }} />
                        {data?.siteName ?? 'SmartFactory CMMS'}
                        {data && (
                            <>
                                {' '}· Snapshot{' '}
                                <time className="sf-ops-num" dateTime={data.generatedAtUtc}>
                                    {new Date(data.generatedAtUtc).toLocaleTimeString('en-GB')}
                                </time>
                            </>
                        )}
                    </span>
                </footer>
            </div>

            {/* Slide-Over Live Machine Inspector Drawer */}
            {inspectorOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
                        onClick={() => setInspectorOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[380px] shadow-2xl">
                        <OperationsSidebarDock
                            machine={activeMachine}
                            allMachines={machines}
                            productionLines={productionLines}
                            thresholds={thresholds}
                            selectedLineId={null}
                            incidents={incidents}
                            workOrders={workOrders}
                            activeTab={dockTab}
                            now={now}
                            variant="sidebar"
                            connectionStatus={connectionStatus}
                            canManageMachines={canManageMachines}
                            busyAction={busyAction}
                            onClose={() => setInspectorOpen(false)}
                            onTabChange={setDockTab}
                            onSelectMachine={id => {
                                setSelectedMachineId(id)
                                setDockTab('inspector')
                            }}
                            onDispatchTech={handleDispatchTech}
                            onRecoverUnit={handleRecoverUnit}
                            onSetMaintenance={handleSetMaintenance}
                            onRecoverLine={handleRecoverLine}
                            onAcknowledgeIncident={handleAcknowledgeIncident}
                            onResolveIncident={handleResolveIncident}
                            onAdvanceWorkOrder={handleAdvanceWorkOrder}
                        />
                    </div>
                </>
            )}

            {/* Production Add Machine Modal */}
            <AddMachineModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={() => {
                    void refresh()
                    showToast('Machine added to fleet')
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
