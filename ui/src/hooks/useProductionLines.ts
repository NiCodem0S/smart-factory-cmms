import { useState, useEffect, useCallback } from "react"
import { ProductionLineDto } from "../types/production"
import { fetchLinesByHallId, haltLineById, startLineById } from "../services/productionLinesService"
import { MachineProductionLineDto } from "../types/machine"
import { fetchMachinesByProdLineId } from "../services/machineService"

export interface ProductionLinesHookOptions {
    enabled?: boolean
    pollIntervalMs?: number
}

export default function useProductionLinesByHallsId(id?: string | null, options?: ProductionLinesHookOptions) {
    const enabled = options?.enabled ?? true
    const pollIntervalMs = options?.pollIntervalMs ?? 5000
    const [lines, setLines] = useState<ProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(enabled)
    const [error, setError] = useState<string | null>(null)

    const loadLines = useCallback(async (signal?: AbortSignal, background = false) => {
        if (!background) setIsLoading(true)
        setError(null)

        try {
            const result = await fetchLinesByHallId(id, signal)
            setLines(result)
        }
        catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }
            setError(err.response?.data?.message || err.message || 'Failed to fetch production lines')
        }
        finally {
            if (!signal?.aborted) setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return
        }

        const controller = new AbortController()

        loadLines(controller.signal)
        const timer = pollIntervalMs > 0
            ? setInterval(() => void loadLines(controller.signal, true), pollIntervalMs)
            : null

        return () => {
            controller.abort()
            if (timer !== null) clearInterval(timer)
        }

    }, [loadLines, enabled, pollIntervalMs])

    return { lines, isLoading, error, refetch: loadLines }
}

export function useMachinesByProductionHallId(id?: string | null, options?: ProductionLinesHookOptions) {
    const enabled = options?.enabled ?? true
    const pollIntervalMs = options?.pollIntervalMs ?? 5000
    const [machines, setMachines] = useState<MachineProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(enabled && Boolean(id))
    const [error, setError] = useState<string | null>(null)

    const loadMachines = useCallback(async (signal?: AbortSignal, background = false) => {

        if (!id) {
            setMachines([])
            setIsLoading(false)
            return
        }

        if (!background) setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachinesByProdLineId(id, signal)
            setMachines(result)
        }
        catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }
            setError(err.response?.data?.message || err.message || `Failed to fetch production ${id} line machines`)
        }
        finally {
            if (!signal?.aborted) setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return
        }

        const controller = new AbortController()

        loadMachines(controller.signal)
        const timer = pollIntervalMs > 0 && id
            ? setInterval(() => void loadMachines(controller.signal, true), pollIntervalMs)
            : null

        return () => {
            controller.abort()
            if (timer !== null) clearInterval(timer)
        }

    }, [loadMachines, enabled, pollIntervalMs, id])

    return { machines, isLoading, error, refetch: loadMachines }
}

export function useProductionLineActions() {
    const [isActionLoading, setIsActionLoading] = useState<boolean>(false)
    const [actionError, setActionError] = useState<string | null>(null)
    const [actionSuccess, setActionSuccess] = useState<string | null>(null)

    const haltLine = async (lineId: string, signal?: AbortSignal) => {
        setIsActionLoading(true)
        setActionError(null)
        setActionSuccess(null)

        try {
            const res = await haltLineById(lineId, signal)
            setActionSuccess(res.message || 'Production line halted.')
            return true
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return false
            }
            const msg = err.response?.data?.message || err.message || 'Failed to halt production line'
            setActionError(msg)
            return false
        } finally {
            if (!signal?.aborted) setIsActionLoading(false)
        }
    }

    const startLine = async (lineId: string, signal?: AbortSignal) => {
        setIsActionLoading(true)
        setActionError(null)
        setActionSuccess(null)

        try {
            const res = await startLineById(lineId, signal)
            setActionSuccess(res.message || 'Production line started.')
            return true
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return false
            }
            const msg = err.response?.data?.message || err.message || 'Failed to start production line'
            setActionError(msg)
            return false
        } finally {
            if (!signal?.aborted) setIsActionLoading(false)
        }
    }

    const clearStatus = () => {
        setActionError(null)
        setActionSuccess(null)
    }

    return {
        haltLine,
        startLine,
        isActionLoading,
        actionError,
        actionSuccess,
        clearStatus
    }
}
