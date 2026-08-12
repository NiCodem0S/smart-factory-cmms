import { useState, useEffect } from "react"
import { FactoryHallDto } from "../types/factory"
import { fetchHalls } from "../services/factoryHallsService"


export function useFactoryHalls() {
    const [data, setData] = useState<FactoryHallDto[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {

        const loadData = (async () => {
            setIsLoading(true)
            setError(null)

            try {
                const result = await fetchHalls();
                setData(result);
            }
            catch (err: any) {
                setError(err.message || 'Unrecognized error durning fetching data')
            }
            finally {
                setIsLoading(false)
            }
        })

        loadData();
    }, [])

    return { data, isLoading, error }
}