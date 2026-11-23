import { useState, useEffect } from "react"
import { FactoryHallDto } from "../types/factory"
import { fetchHalls } from "../services/factoryHallsService"
import { useAuth } from "../context/AuthContext";


export function useFactoryHalls(enabled = true) {
    const { user } = useAuth();
    const [data, setData] = useState<FactoryHallDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(enabled)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {

        if (!enabled) {
            setIsLoading(false);
            return;
        }

        if (!user) {
            setData([]);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();

        const loadData = async () => {
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
        }

        loadData();

        return () => {
            controller.abort()
        }
    }, [user?.id, user?.role, enabled])

    return { data, isLoading, error }
}