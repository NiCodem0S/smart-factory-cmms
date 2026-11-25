import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Activity,
    Building2,
    Menu,
    Moon,
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
import {
    deriveLineState,
    machineCode,
    nextWorkOrderStatus,
    shortHallPillName,
} from './operationsHelpers'
import OperationsPulseBento, { type PowerHistoryPoint } from './OperationsPulseBento'
import OperationsHeatmap from './OperationsHeatmap'
import OperationsProductionLines from './OperationsProductionLines'
import OperationsSidebarDock, { type OperationsDockTab } from './OperationsSidebarDock'
import OperationsLabFab, { type DockLayoutVariant } from './OperationsLabFab'
import './operations-dashboard.css'

const THEME_STORAGE_KEY = 'sf-operations-theme'
const LAYOUT_STORAGE_KEY = 'sf-operations-layout'

export default function OperationsDashboard() {
    const { user } = useAuth()
    const { halls, selectedHallId, setSelectedHallId, isLoadingHalls } = useFactory()
    const navigation = useContext(NavigationContext)
    const [searchParams, setSearchParams] = useSearchParams()

    const isSuperAdmin = user?.role === 'SuperAdmin'
    const canManageMachines = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin'

    const [isPaused, setIsPaused] = useState(false)
    const { data, loading, refreshing, error, refresh, connectionStatus } = useLiveDashboard({ paused: isPaused })

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return stored === 'dark' ? 'dark' : 'light'
    })

    const [layoutVariant, setLayoutVariantState] = useState<DockLayoutVariant>(() => {
        const qp = searchParams.get('layout')
        if (qp === 'dock' || qp === 'sidebar') return qp
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
        return stored === 'dock' ? 'dock' : 'sidebar'
    })

    const [dockTab, setDockTab] = useState<OperationsDockTab>('alerts')
    const [statusFilter, setStatusFilter] = useState<MachineStatus | 'All'>('All')
    const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [now, setNow] = useState<number>(() => Date.now())
    const [toast, setToast] = useState<string | null>(null)
    const [powerHistory, setPowerHistory] = useState<{ scope: string; points: PowerHistoryPoint[] }>({
        scope: 'global',
        points: [],
    })

    const toastTimerRef = useRef<number | null>(null)
    const scopeKey = data?.factoryHallId ?? 'global'

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

    const setLayoutVariant = (next: DockLayoutVariant) => {
        setLayoutVariantState(next)
        localStorage.setItem(LAYOUT_STORAGE_KEY, next)
        const params = new URLSearchParams(searchParams)
        params.set('layout', next)
        setSearchParams(params, { replace: true })
        showToast(next === 'sidebar' ? 'Switched to Right Sidebar layout' : 'Switched to Card Dock layout')
    }

    // Keep relative timestamps ticking smoothly every second
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    // Record live rolling plant power history points from real dashboard snapshots & SignalR merges
    const livePowerKw = data?.summary.powerLoadKw ?? null
    const snapshotStamp = data?.generatedAtUtc ?? null
    useEffect(() => {
        if (livePowerKw === null || !snapshotStamp) return
        const ts = Date.now()
        setPowerHistory(prev => {
            const existing = prev.scope === scopeKey ? prev.points : []
            const last = existing[existing.length - 1]
            if (last && ts - last.ts < 800 && Math.abs(last.kw - livePowerKw) < 0.05) {
                return prev
            }
            return {
                scope: scopeKey,
                points: [...existing, { ts, kw: Math.round(livePowerKw * 10) / 10 }].slice(-30),
            }
        })
    }, [livePowerKw, snapshotStamp, scopeKey])

    const machines = data?.machines ?? []
    const incidents = data?.incidents ?? []
    const productionLines = data?.productionLines ?? []
    const workOrders = data?.workOrders ?? []
    const thresholds = data?.thresholds ?? []

    // Resolve active machine safely within the current hall scope
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

    // Resolve active line safely within the current hall scope
    const activeLineId = useMemo(() => {
        if (!selectedLineId) return null
        if (selectedLineId === 'utilities') {
            return machines.some(m => m.productionLineId === null) ? 'utilities' : null
        }
        return productionLines.some(l => l.id === selectedLineId) ? selectedLineId : null
    }, [selectedLineId, productionLines, machines])

    const handleHallChange = (hallId: string | null) => {
        setSelectedHallId(hallId)
        setSelectedLineId(null)
        setSelectedMachineId(null)
    }

    const handleSelectMachine = (machineId: string) => {
        setSelectedLineId(null)
        setSelectedMachineId(machineId)
        setDockTab('inspector')
    }

    const handleSelectLine = (lineId: string) => {
        setSelectedLineId(lineId)
        setDockTab('inspector')
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

    const handleDispatchTech = (machine: DashboardMachine) =>
        void runAction(`dispatch-${machine.id}`, async () => {
            const created = await dispatchDashboardWorkOrder(machine.id)
            return `Dispatched ${created.assigneeName ?? 'technician'} to ${machineCode(machine)} · ${created.ticketNumber}`
        })

    const recoverMachineToRunning = async (machine: DashboardMachine) => {
        if (machine.telemetrySource === 'RealDevice') {
            if (machine.status === 'Maintenance') {
                await simulationService.action(machine.id, 'repair', true)
            }
            return
        }
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

    const handleRecoverUnit = (machine: DashboardMachine) =>
        void runAction(`recover-${machine.id}`, async () => {
            if (machine.telemetrySource === 'RealDevice') {
                await recoverMachineToRunning(machine)
                return `${machineCode(machine)} maintenance cleared — awaiting device telemetry`
            }
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
            if (lineId === 'utilities') {
                const targets = machines.filter(m => m.productionLineId === null && m.status !== 'Running')
                for (const m of targets) {
                    await recoverMachineToRunning(m)
                }
                return 'Utility units restored to service'
            }

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

    const handleTestFault = () =>
        void runAction('fault', async () => {
            const running = machines.filter(m => m.status === 'Running' && m.telemetrySource !== 'RealDevice')
            if (!running.length) {
                return 'No running simulated machines available to fault'
            }
            const target = running[Math.floor(Math.random() * running.length)]
            await simulationService.action(target.id, 'start', true)
            await simulationService.scenario(target.id, 'Overheating')
            setSelectedLineId(null)
            setSelectedMachineId(target.id)
            return `Triggered overheating fault on ${machineCode(target)}`
        })

    const handleRecoverAll = () =>
        void runAction('recover-all', async () => {
            const broken = machines.filter(
                m => m.status === 'Error' || m.status === 'Warning' || m.status === 'Maintenance'
            )
            for (const m of broken) {
                await recoverMachineToRunning(m)
            }
            for (const line of productionLines) {
                const stations = machines.filter(m => m.productionLineId === line.id)
                if (deriveLineState(line, stations) === 'Halted') {
                    for (const station of stations) {
                        if (station.telemetrySource !== 'RealDevice' && (station.status === 'Offline' || station.status === 'Running')) {
                            await simulationService.action(station.id, 'start', true)
                        }
                    }
                    const hasOfflineRealDevice = stations.some(
                        s => s.telemetrySource === 'RealDevice' && (s.status === 'Offline' || s.status === 'Error' || s.status === 'Maintenance')
                    )
                    if (!hasOfflineRealDevice) {
                        await startLineById(line.id)
                    }
                }
            }
            return 'Recovery commands sent for all faulted units & halted lines'
        })

    const handleRefreshNow = () =>
        void runAction('refresh', async () => {
            if (isPaused) setIsPaused(false)
            return 'Dashboard snapshot refreshed'
        })

    // Hall selector options for Select fallback (>3 halls or non-SuperAdmin)
    const hallOptions = isSuperAdmin
        ? [{ value: null, label: 'All Factory Halls' }, ...halls.map(h => ({ value: h.id, label: h.name }))]
        : halls.map(h => ({ value: h.id, label: h.name }))

    const assignedHall = halls.find(h => h.id === (selectedHallId ?? user?.factoryHallId))
    const showHallPills = isSuperAdmin && halls.length > 0 && halls.length <= 3

    const headerBar = (
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
                    Live Operations
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
                        style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)', color: 'var(--sf-text-2)' }}
                    >
                        <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--sf-muted)' }} />
                        <span className="truncate max-w-[220px]">{shortHallPillName(assignedHall.name)}</span>
                    </span>
                ) : null}

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
    )

    const dockComponent = (
        <OperationsSidebarDock
            machine={activeMachine}
            allMachines={machines}
            productionLines={productionLines}
            thresholds={thresholds}
            selectedLineId={activeLineId}
            incidents={incidents}
            workOrders={workOrders}
            activeTab={dockTab}
            now={now}
            variant={layoutVariant}
            connectionStatus={connectionStatus}
            canManageMachines={canManageMachines}
            busyAction={busyAction}
            onTabChange={setDockTab}
            onSelectMachine={handleSelectMachine}
            onDispatchTech={handleDispatchTech}
            onRecoverUnit={handleRecoverUnit}
            onSetMaintenance={handleSetMaintenance}
            onRecoverLine={handleRecoverLine}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
            onAdvanceWorkOrder={handleAdvanceWorkOrder}
        />
    )

    const statusBanner = (
        <>
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
                        {error.includes('timeout') ? 'Dashboard refresh timed out.' : error}{' '}
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
                <div className="sf-ops-card p-8 flex items-center justify-center gap-2.5 text-sm" role="status" style={{ color: 'var(--sf-muted)' }}>
                    <Activity className="w-5 h-5 animate-pulse" style={{ color: 'var(--sf-accent)' }} />
                    <span>Loading live factory telemetry…</span>
                </div>
            )}
        </>
    )

    const footerBar = (
        <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-4 text-[11px]" style={{ color: 'var(--sf-muted)' }}>
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
    )

    const currentPowerPoints = powerHistory.scope === scopeKey ? powerHistory.points : []

    return (
        <div className="sf-ops-root min-h-full" data-theme={theme}>
            {layoutVariant === 'sidebar' ? (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_308px] 2xl:grid-cols-[minmax(0,1fr)_324px] min-h-full">
                    <div className="min-w-0 flex flex-col">
                        {headerBar}
                        <div className="p-4 md:p-5 space-y-5 flex-1 min-w-0">
                            {statusBanner}
                            {data && (
                                <>
                                    <OperationsPulseBento
                                        data={data}
                                        powerHistory={currentPowerPoints}
                                        now={now}
                                        statusFilter={statusFilter}
                                        onStatusFilterChange={setStatusFilter}
                                        onInspectMachine={handleSelectMachine}
                                        onOpenTickets={() => setDockTab('tickets')}
                                    />
                                    <OperationsHeatmap
                                        machines={machines}
                                        selectedMachineId={activeLineId ? null : activeMachine?.id ?? null}
                                        statusFilter={statusFilter}
                                        onSelectMachine={handleSelectMachine}
                                    />
                                    <OperationsProductionLines
                                        lines={productionLines}
                                        machines={machines}
                                        now={now}
                                        selectedMachineId={activeLineId ? null : activeMachine?.id ?? null}
                                        selectedLineId={activeLineId}
                                        statusFilter={statusFilter}
                                        onSelectMachine={handleSelectMachine}
                                        onSelectLine={handleSelectLine}
                                    />
                                </>
                            )}
                            {footerBar}
                        </div>
                    </div>

                    <div className="min-w-0 xl:sticky xl:top-0 xl:h-dvh">
                        {dockComponent}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col min-h-full">
                    {headerBar}
                    <div className="p-4 md:p-6 lg:p-7 space-y-5 max-w-[1860px] w-full mx-auto flex-1">
                        {statusBanner}
                        {data && (
                            <>
                                <OperationsPulseBento
                                    data={data}
                                    powerHistory={currentPowerPoints}
                                    now={now}
                                    statusFilter={statusFilter}
                                    onStatusFilterChange={setStatusFilter}
                                    onInspectMachine={handleSelectMachine}
                                    onOpenTickets={() => setDockTab('tickets')}
                                />
                                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_385px] gap-5 items-start">
                                    <div className="min-w-0 space-y-5">
                                        <OperationsHeatmap
                                            machines={machines}
                                            selectedMachineId={activeLineId ? null : activeMachine?.id ?? null}
                                            statusFilter={statusFilter}
                                            onSelectMachine={handleSelectMachine}
                                        />
                                        <OperationsProductionLines
                                            lines={productionLines}
                                            machines={machines}
                                            now={now}
                                            selectedMachineId={activeLineId ? null : activeMachine?.id ?? null}
                                            selectedLineId={activeLineId}
                                            statusFilter={statusFilter}
                                            onSelectMachine={handleSelectMachine}
                                            onSelectLine={handleSelectLine}
                                        />
                                    </div>
                                    <div className="min-w-0 xl:sticky xl:top-[76px]">
                                        {dockComponent}
                                    </div>
                                </div>
                            </>
                        )}
                        {footerBar}
                    </div>
                </div>
            )}

            {/* Floating Purple 4th-Wall Lab Menu (Layout Switcher + Backend Simulation Controls) */}
            <OperationsLabFab
                isPaused={isPaused}
                canRunSimulation={canManageMachines}
                busyAction={busyAction}
                layoutVariant={layoutVariant}
                offsetForRightSidebar={layoutVariant === 'sidebar'}
                onLayoutVariantChange={setLayoutVariant}
                onTogglePause={() => {
                    setIsPaused(p => {
                        const next = !p
                        showToast(next ? 'Live dashboard updates paused' : 'Live dashboard updates resumed')
                        return next
                    })
                }}
                onRefreshNow={handleRefreshNow}
                onTestFault={handleTestFault}
                onRecoverAll={handleRecoverAll}
            />

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
