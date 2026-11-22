import { useCallback, useEffect, useRef, useState } from 'react'
import { simulationError, simulationService } from '../services/simulationService'
import { useTelemetrySubscription } from './useTelemetrySubscription'
import { mergeLive, mergeSnapshot } from '../utils/telemetrySeries'
import type { SimulationMachine } from '../types/simulation'

export function useSimulationMachine(machineId: string) {
    const [machine, setMachine] = useState<SimulationMachine | null>(null)
    const [error, setError] = useState<string | null>(null)
    const activeId = useRef(machineId)
    activeId.current = machineId
    const refresh = useCallback(async () => {
        try {
            const result = await simulationService.state(machineId)
            if (activeId.current !== machineId) {
                return
            }

            setMachine(current => mergeSnapshot(current, result))
            setError(null)
        } catch (e) {
            if (activeId.current === machineId) {
                setError(simulationError(e))
            }
        }
    }, [machineId])
    useEffect(() => {
        activeId.current = machineId
        setMachine(null)
        void refresh()
        const interval = setInterval(() => void refresh(), 5000)
        return () => {
            clearInterval(interval)
            activeId.current = ''
        }
    }, [refresh])
    const connectionStatus = useTelemetrySubscription(
        state => setMachine(current => (current ? mergeLive(current, state) : current)),
        { machineId, onReconnect: () => void refresh() },
    )
    return { machine, error, refresh, connectionStatus }
}
