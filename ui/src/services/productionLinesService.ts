import { apiClient } from './apiClient'
import { ProductionLineDto } from '../types/production'

export async function fetchLinesByHallId(
    factoryHallId?: string | null,
    signal?: AbortSignal
): Promise<ProductionLineDto[]> {
    const response = await apiClient.get<ProductionLineDto[]>(`/ProductionLines`, {
        params: factoryHallId ? { factoryHallId } : {},
        signal
    })

    return response.data
}

export async function haltLineById(
    lineId: string,
    signal?: AbortSignal
): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`/ProductionLines/${lineId}/halt`, null, {
        signal
    })

    return response.data
}

export async function startLineById(
    lineId: string,
    signal?: AbortSignal
): Promise<{ message: string; line?: ProductionLineDto }> {
    const response = await apiClient.post<{ message: string; line?: ProductionLineDto }>(`/ProductionLines/${lineId}/start`, null, {
        signal
    })

    return response.data
}