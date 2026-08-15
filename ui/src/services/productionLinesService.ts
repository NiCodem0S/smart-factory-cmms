import { apiClient } from './apiClient'
import { ProductionLineDto } from '../types/production'

export async function fetchLinesByHallId(
    factoryHallId: string | null
): Promise<ProductionLineDto[]> {
    const response = await apiClient.get<ProductionLineDto[]>(`/ProductionLines`, {
        params: factoryHallId ? { factoryHallId } : {}
    })

    return response.data
}