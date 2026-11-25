import { apiClient } from './apiClient'
import type { FetchIncidentsParams, IncidentHistoryResponse, IncidentStatus } from '../types/incident'

export async function fetchIncidentHistory(
    params: FetchIncidentsParams,
    signal?: AbortSignal,
): Promise<IncidentHistoryResponse> {
    const query: Record<string, string | number> = {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
        range: params.range ?? '7d',
    }
    if (params.factoryHallId) query.factoryHallId = params.factoryHallId
    if (params.machineId) query.machineId = params.machineId
    if (params.status && params.status !== 'All') query.status = params.status
    if (params.severity && params.severity !== 'All') query.severity = params.severity
    if (params.search?.trim()) query.search = params.search.trim()

    const { data } = await apiClient.get<IncidentHistoryResponse>('/incidents', {
        params: query,
        signal,
    })
    return data
}

export async function updateIncidentStatus(
    incidentId: string,
    status: IncidentStatus,
): Promise<void> {
    await apiClient.patch(`/incidents/${incidentId}/status`, { status })
}
