import { useState, useEffect } from "react"
import { FactoryHallDto } from "../types/factory"
import { fetchHalls } from "../services/factoryHallsService"


export function useFactoryHalls() {
    const [data, setData] = useState<FactoryHallDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {

        const controller = new AbortController();

        const loadData = (async () => {
            setIsLoading(true)
            setError(null)

            try {
                const result = await fetchHalls(controller.signal);
                setData(result);
            }
            catch (err: any) {
                if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                    return;
                }
                setError(err.message || 'Unrecognized error durning fetching data')
            }
            finally {
                if (!controller.signal?.aborted) setIsLoading(false)
            }
        })

        loadData();

        return () => {
            controller.abort()
        }
    }, [])

    return { data, isLoading, error }
}