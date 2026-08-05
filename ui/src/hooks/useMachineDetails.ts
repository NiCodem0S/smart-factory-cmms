import { useState, useEffect, useCallback } from 'react'
import { MachineDetailDto } from '../types/machine'
import { fetchMachinesById } from '../services/machineService'


export default function useMachineDetails(id: string | undefined) {
    const [machine, setMachine] = useState<MachineDetailDto | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadMachine = useCallback(async () => {
        if (!id) return

        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachinesById(id)
            setMachine(result)
        }
        catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch details')
        }
        finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        loadMachine()
    }, [loadMachine])

    return { machine, isLoading, error, refetch: loadMachine }
}