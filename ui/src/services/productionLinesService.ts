import { apiClient } from './apiClient'
import { ProductionLineDto } from '../types/production'

export async function fetchLinesByHallId(
    factoryHallId: string
): Promise<ProductionLineDto[]> {
    const response = await apiClient.get<ProductionLineDto[]>(`/ProductionLines`, {
        params: {
            factoryHallId
        }
    })

    return response.data
}