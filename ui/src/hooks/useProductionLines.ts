import { useState, useEffect, useCallback } from "react"
import { ProductionLineDto } from "../types/production"
import { fetchLinesByHallId } from "../services/productionLinesService"
import { MachineProductionLineDto } from "../types/machine"
import { fetchMachinesByProdLineId } from "../services/machineService"

export default function useProductionLinesByHallsId(id: string) {
    const [lines, setLines] = useState<ProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadLines = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchLinesByHallId(id)
            setLines(result)
        }
        catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch production lines')
        }
        finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        loadLines()
    }, [loadLines])

    return { lines, isLoading, error, refetch: loadLines }
}

export function useMachinesByProductionHallId(id: string) {
    const [machines, setMachines] = useState<MachineProductionLineDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadMachines = useCallback(async () => {

        if (!id) {
            setMachines([])
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachinesByProdLineId(id)
            setMachines(result)
        }
        catch (err: any) {
            setError(err.response?.data?.message || err.message || `Failed to fetch production ${id} line machines`)
        }
        finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        loadMachines()
    }, [loadMachines])

    return { machines, isLoading, error, refetch: loadMachines }
}
