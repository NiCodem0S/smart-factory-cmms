import { useState, useEffect, useCallback } from "react";
import { MachineListDto, MachineStatus } from "../types/machine";
import { PagedResult } from "../types/common";
import { fetchMachines } from "../services/machineService";

export function useMachines(page: number = 1, pageSize: number = 10, search?: string, status?: MachineStatus) {

    const [data, setData] = useState<PagedResult<MachineListDto> | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachines(page, pageSize, search, status, signal);
            setData(result)
        }
        catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }
            setError(err.message || 'Unrecognized error durning fetching data')
        }
        finally {
            if (!signal?.aborted) setIsLoading(false)
        }

    }, [page, pageSize, search, status]);

    useEffect(() => {

        const controller = new AbortController();

        loadData(controller.signal)

        return () => {
            controller.abort()
        }

    }, [loadData])

    return { data, isLoading, error, refetch: loadData }
}