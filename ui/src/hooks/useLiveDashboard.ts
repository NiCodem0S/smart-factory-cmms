import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFactory } from '../context/FactoryContext'
import { fetchDashboard } from '../services/dashboardService'
import { simulationError } from '../services/simulationService'
import type { DashboardMachine, DashboardSnapshot } from '../types/dashboard'
import type { MachineSimState } from '../types/simulation'
import { withLiveReadings, type LiveReading } from '../utils/dashboardTelemetry'
import { telemetryTimestamp } from '../utils/telemetrySeries'
import { useTelemetrySubscription } from './useTelemetrySubscription'

const snapshotIntervalMs = 5_000
const liveUpdateIntervalMs = 250

interface DashboardView {
    key: string
    data: DashboardSnapshot | null
    refreshing: boolean
    error: string | null
}

interface DashboardSession {
    key: string
    refresh: (foreground?: boolean, queueIfBusy?: boolean) => Promise<void>
    receive: (state: MachineSimState) => void
}

export interface UseLiveDashboardOptions {
    paused?: boolean
}

export function useLiveDashboard(options?: UseLiveDashboardOptions) {
    const paused = options?.paused ?? false
    const pausedRef = useRef(paused)
    pausedRef.current = paused

    const { user } = useAuth()
    const { selectedHallId } = useFactory()
    const factoryHallId = user?.role === 'SuperAdmin' ? selectedHallId : user?.factoryHallId ?? null
    const key = user ? `${user.id}/${user.role}/${factoryHallId ?? ''}` : null
    const sessionRef = useRef<DashboardSession | null>(null)
    const [view, setView] = useState<DashboardView | null>(null)

    useEffect(() => {
        if (!key) return
        const scopeKey = key
        const controller = new AbortController()
        let data: DashboardSnapshot | null = null
        let error: string | null = null
        let refreshing = false
        let loadingSnapshot = false
        let queuedRefresh = false
        let statusChanged = false
        let snapshotAt = 0
        let liveTimer: ReturnType<typeof setTimeout> | undefined
        let accessibleMachines = new Map<string, DashboardMachine>()
        const readings = new Map<string, LiveReading>()

        function publish() {
            if (!controller.signal.aborted) setView({ key: scopeKey, data, error, refreshing })
        }

        async function refresh(foreground = false, queueIfBusy = false) {
            if (controller.signal.aborted) return
            if (!foreground && pausedRef.current && data !== null) return
            if (foreground) {
                refreshing = true
                publish()
            }
            if (loadingSnapshot) {
                queuedRefresh ||= queueIfBusy
                return
            }

            loadingSnapshot = true
            try {
                const snapshot = await fetchDashboard(factoryHallId, controller.signal)
                if (controller.signal.aborted) return
                accessibleMachines = new Map(snapshot.machines.map(machine => [machine.id, machine]))
                snapshotAt = telemetryTimestamp(snapshot.generatedAtUtc)
                for (const id of readings.keys()) {
                    if (!accessibleMachines.has(id)) readings.delete(id)
                }
                data = withLiveReadings(snapshot, readings)
                error = null
            } catch (cause) {
                if (!controller.signal.aborted) error = simulationError(cause)
            } finally {
                loadingSnapshot = false
                refreshing = false
                publish()
                if (queuedRefresh && !controller.signal.aborted) {
                    queuedRefresh = false
                    void refresh()
                }
            }
        }

        function receive(state: MachineSimState) {
            const machine = accessibleMachines.get(state.machineId)
            if (!machine) return
            const at = telemetryTimestamp(state.lastTickAtUtc)
            const previousReading = readings.get(state.machineId)
            if (!Number.isFinite(at) || at <= (previousReading?.at ?? 0)) return
            const previousStatus = previousReading && previousReading.at >= snapshotAt
                ? previousReading.state.machineStatus : machine.status
            statusChanged ||= at >= snapshotAt && state.machineStatus !== previousStatus
            readings.set(state.machineId, { at, state })
            if (pausedRef.current) return
            liveTimer ??= setTimeout(() => {
                liveTimer = undefined
                if (pausedRef.current) return
                if (data) {
                    const updated = withLiveReadings(data, readings)
                    if (updated !== data) {
                        data = updated
                        publish()
                    }
                }
                // Only a newly received transition can request an incident refresh.
                if (statusChanged) {
                    statusChanged = false
                    void refresh(false, true)
                }
            }, liveUpdateIntervalMs)
        }

        sessionRef.current = { key: scopeKey, refresh, receive }
        publish()
        void refresh()
        const timer = setInterval(() => void refresh(), snapshotIntervalMs)
        return () => {
            sessionRef.current = null
            controller.abort()
            clearInterval(timer)
            clearTimeout(liveTimer)
        }
    }, [key, factoryHallId])

    // When unpausing, immediately sync latest readings and snapshot
    const wasPausedRef = useRef(paused)
    useEffect(() => {
        if (wasPausedRef.current && !paused) {
            const session = sessionRef.current
            if (session?.key === key) void session.refresh(false, true)
        }
        wasPausedRef.current = paused
    }, [paused, key])

    const refresh = useCallback(async () => {
        const session = sessionRef.current
        if (session?.key === key) await session.refresh(true)
    }, [key])

    const current = view?.key === key ? view : null
    const data = current?.data ?? null
    const hallIds = data?.hallIds ?? []
    const socketStatus = useTelemetrySubscription(state => {
        const session = sessionRef.current
        if (session?.key === key) session.receive(state)
    }, {
        hallIds,
        onReconnect: () => {
            const session = sessionRef.current
            if (hallIds.length && session?.key === key && !pausedRef.current) {
                void session.refresh(false, true)
            }
        },
    })

    return {
        data,
        loading: !!key && !data && !current?.error,
        refreshing: current?.refreshing ?? false,
        error: current?.error ?? null,
        refresh,
        connectionStatus: data && !hallIds.length ? 'No halls' : paused ? 'Paused' : socketStatus,
    }
}
