import { useState, useEffect, useCallback } from 'react'
import { MachineDetailDto } from '../types/machine'
import { fetchMachinesById } from '../services/machineService'


export default function useMachineDetails(id: string | undefined) {
    const [machine, setMachine] = useState<MachineDetailDto | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadMachine = useCallback(async (signal?: AbortSignal) => {
        if (!id) return

        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachinesById(id, signal)
            setMachine(result)
        }
        catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }
            setError(err.response?.data?.message || err.message || 'Failed to fetch details')
        }
        finally {
            if (!signal?.aborted) setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        const controller = new AbortController()

        loadMachine(controller.signal)

        return () => {
            controller.abort()
        }
    }, [loadMachine])

    return { machine, isLoading, error, refetch: loadMachine }
}