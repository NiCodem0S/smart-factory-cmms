import { apiClient } from './apiClient'
import { FactoryHallDto } from '../types/factory'

export async function fetchHalls(): Promise<FactoryHallDto[]> {
    const response = await apiClient.get<FactoryHallDto[]>('/FactoryHalls')

    return response.data;
}

export async function fetchHallById(
    id: string
): Promise<FactoryHallDto> {
    const response = await apiClient.get<FactoryHallDto>(`/FactoryHalls/${id}`)
    return response.data
}