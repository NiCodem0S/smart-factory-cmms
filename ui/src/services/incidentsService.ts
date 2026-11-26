import { apiClient } from './apiClient'
import type { FetchIncidentsParams, IncidentHistoryResponse, IncidentStatus } from '../types/incident'

export async function fetchIncidentHistory(
    params: FetchIncidentsParams,
    signal?: AbortSignal,
): Promise<IncidentHistoryResponse> {
    const query: Record<string, string | number | boolean> = {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
        range: params.range ?? '7d',
        includeInsights: params.includeInsights ?? true,
    }
    if (params.factoryHallId) query.factoryHallId = params.factoryHallId
    if (params.machineId) query.machineId = params.machineId
    if (params.status && params.status !== 'All') query.status = params.status
    if (params.severity && params.severity !== 'All') query.severity = params.severity
    if (params.search?.trim()) query.search = params.search.trim()

    // Bounded extended timeouts aligned slightly above server SQL CommandTimeout (60s for 'all')
    // so the browser receives clean server errors instead of hanging indefinitely on dead sockets.
    const timeout =
        params.range === 'all' ? 65_000 : params.range === '30d' ? 30_000 : undefined

    const { data } = await apiClient.get<IncidentHistoryResponse>('/incidents', {
        params: query,
        timeout,
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
