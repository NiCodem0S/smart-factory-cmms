import { apiClient } from './apiClient'
import type { DashboardSnapshot, DashboardWorkOrder } from '../types/dashboard'
import type { TelemetryReadDto } from '../types/machine'

export async function fetchDashboard(factoryHallId: string | null, signal: AbortSignal): Promise<DashboardSnapshot> {
    const { data } = await apiClient.get<DashboardSnapshot>('/dashboard', {
        params: factoryHallId ? { factoryHallId } : undefined,
        signal,
    })
    return data
}

export async function updateDashboardIncidentStatus(
    incidentId: string,
    status: 'Active' | 'Acknowledged' | 'Resolved',
): Promise<void> {
    await apiClient.patch(`/dashboard/incidents/${incidentId}/status`, { status })
}

export async function dispatchDashboardWorkOrder(
    machineId: string,
    title?: string,
    type?: string,
): Promise<DashboardWorkOrder> {
    const { data } = await apiClient.post<DashboardWorkOrder>('/dashboard/workorders/dispatch', {
        machineId,
        title,
        type,
    })
    return data
}

export async function updateDashboardWorkOrderStatus(
    workOrderId: string,
    status: 'Open' | 'InProgress' | 'Resolved',
): Promise<void> {
    await apiClient.patch(`/dashboard/workorders/${workOrderId}/status`, { status })
}

interface TelemetrySeriesResponse {
    toUtc: string
    samples: TelemetryReadDto[]
}

export async function fetchMachineTelemetrySamples(
    machineId: string,
    signal?: AbortSignal,
): Promise<TelemetryReadDto[]> {
    try {
        const { data } = await apiClient.get<TelemetrySeriesResponse>(`/machines/${machineId}/telemetry/series`, {
            params: { windowMinutes: 1 },
            signal,
        })
        if (data.samples.length >= 2) {
            return data.samples
        }
    } catch (err) {
        if (signal?.aborted) throw err
    }

    const { data: recent } = await apiClient.get<TelemetryReadDto[]>(`/machines/${machineId}/telemetry`, {
        params: { limit: 30 },
        signal,
    })
    return [...recent].reverse()
}
