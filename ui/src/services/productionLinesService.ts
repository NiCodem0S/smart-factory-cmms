import { apiClient } from './apiClient'
import { ProductionLineDto } from '../types/production'

export async function fetchLinesByHallId(
    factoryHallId?: string | null,
    signal?: AbortSignal
): Promise<ProductionLineDto[]> {
    const response = await apiClient.get<ProductionLineDto[]>(`/ProductionLines`, {
        params: factoryHallId ? { factoryHallId } : {}, signal
    })

    return response.data
}