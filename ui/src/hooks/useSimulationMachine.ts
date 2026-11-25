import { useCallback, useEffect, useRef, useState } from 'react'
import { simulationError, simulationService } from '../services/simulationService'
import { useTelemetrySubscription } from './useTelemetrySubscription'
import { mergeLive, mergeSnapshot } from '../utils/telemetrySeries'
import type { MachineSimState, SimulationMachine } from '../types/simulation'

export function useSimulationMachine(machineId: string, pollSimulation = true) {
    const [machine, setMachine] = useState<SimulationMachine | null>(null)
    const [liveState, setLiveState] = useState<MachineSimState | null>(null)
    const [error, setError] = useState<string | null>(null)
    const activeId = useRef(machineId)
    activeId.current = machineId

    const refresh = useCallback(async () => {
        if (!machineId || !pollSimulation) {
            return
        }
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
    }, [machineId, pollSimulation])

    useEffect(() => {
        activeId.current = machineId
        setMachine(null)
        setLiveState(null)
        setError(null)
        if (!machineId || !pollSimulation) {
            return () => {
                activeId.current = ''
            }
        }
        void refresh()
        const interval = setInterval(() => void refresh(), 5000)
        return () => {
            clearInterval(interval)
            activeId.current = ''
        }
    }, [machineId, pollSimulation, refresh])

    const connectionStatus = useTelemetrySubscription(
        state => {
            if (state.machineId !== activeId.current) return
            setLiveState(state)
            setMachine(current => (current ? mergeLive(current, state) : current))
        },
        { machineId: machineId || undefined, onReconnect: pollSimulation ? () => void refresh() : undefined },
    )

    return { machine, liveState: machine?.state ?? liveState, error, refresh, connectionStatus }
}
