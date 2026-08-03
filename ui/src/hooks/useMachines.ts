import { useState, useEffect, useCallback } from "react";
import { MachineListDto, MachineStatus } from "../types/machine";
import { PagedResult } from "../types/common";
import { fetchMachines } from "../services/machineService";

export function useMachines(page: number = 1, pageSize: number = 10, search?: string, status?: MachineStatus) {

    const [data, setData] = useState<PagedResult<MachineListDto> | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const result = await fetchMachines(page, pageSize, search, status);
            setData(result)
        }
        catch (err: any) {
            setError(err.message || 'Unrecognized error durning fetching data')
        }
        finally {
            setIsLoading(false)
        }
    }, [page, pageSize, search, status]);

    useEffect(() => {
        loadData()
    }, [loadData])

    return { data, isLoading, error, refetch: loadData }
}