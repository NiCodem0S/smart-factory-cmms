import { useState, useEffect, useCallback } from "react"
import { ProductionLineDto } from "../types/production"
import { fetchLinesByHallId } from "../services/productionLinesService"
import { MachineProductionLineDto } from "../types/machine"
import { fetchMachinesByProdLineId } from "../services/machineService"

export default function useProductionLinesByHallsId(id: string | null) {
    const [lines, setLines] = useState<ProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadLines = useCallback(async (signal?: AbortSignal) => {
        setIsLoading(true)
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
        const controller = new AbortController()

        loadLines(controller.signal)

        return () => {
            controller.abort()
        }

    }, [loadLines])

    return { lines, isLoading, error, refetch: loadLines }
}

export function useMachinesByProductionHallId(id: string) {
    const [machines, setMachines] = useState<MachineProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadMachines = useCallback(async (signal?: AbortSignal) => {

        if (!id) {
            setMachines([])
            setIsLoading(false)
            return
        }

        setIsLoading(true)
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
        const controller = new AbortController()

        loadMachines(controller.signal)

        return () => {
            controller.abort()
        }

    }, [loadMachines])

    return { machines, isLoading, error, refetch: loadMachines }
}
