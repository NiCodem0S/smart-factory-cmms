import { apiClient } from './apiClient'
import type {
    CreateMaintenanceWorkOrderPayload,
    FetchMaintenanceParams,
    MaintenanceMachineOption,
    MaintenanceOverview,
    MaintenanceWorkOrder,
    PatchMaintenanceWorkOrderPayload,
} from '../types/maintenance'

export async function fetchMaintenanceOverview(
    params: FetchMaintenanceParams,
    signal?: AbortSignal,
): Promise<MaintenanceOverview> {
    const query: Record<string, string | number> = {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
        resolvedRange: params.resolvedRange ?? '7d',
    }
    if (params.factoryHallId) query.factoryHallId = params.factoryHallId
    if (params.status && params.status !== 'All') query.status = params.status
    if (params.type && params.type !== 'All') query.type = params.type
    if (params.assignedUserId) query.assignedUserId = params.assignedUserId
    if (params.machineId) query.machineId = params.machineId
    if (params.search?.trim()) query.search = params.search.trim()

    const { data } = await apiClient.get<MaintenanceOverview>('/maintenance/workorders', {
        params: query,
        signal,
    })
    return data
}

export async function fetchMaintenanceMachines(
    factoryHallId?: string | null,
    signal?: AbortSignal,
): Promise<MaintenanceMachineOption[]> {
    const { data } = await apiClient.get<MaintenanceMachineOption[]>('/maintenance/machines', {
        params: factoryHallId ? { factoryHallId } : undefined,
        signal,
    })
    return data
}

export async function createMaintenanceWorkOrder(
    payload: CreateMaintenanceWorkOrderPayload,
): Promise<MaintenanceWorkOrder> {
    const { data } = await apiClient.post<MaintenanceWorkOrder>('/maintenance/workorders', payload)
    return data
}

export async function patchMaintenanceWorkOrder(
    id: string,
    payload: PatchMaintenanceWorkOrderPayload,
): Promise<void> {
    await apiClient.patch(`/maintenance/workorders/${id}`, payload)
}

export async function deleteMaintenanceWorkOrder(id: string): Promise<void> {
    await apiClient.delete(`/maintenance/workorders/${id}`)
}
