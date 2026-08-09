import { apiClient } from './apiClient'
import { FactoryHallListDto } from '../types/factory'

export async function fetchHalls(): Promise<FactoryHallListDto[]> {
    const response = await apiClient.get<FactoryHallListDto>('/FactoryHalls')

    return response.data;
}

export async function fetchHallById(
    id: string
): Promise<FactoryHallListDto> {
    const response = await apiClient.get<FactoryHallListDto>(`/FactoryHalls/${id}`)
    return response.data
}