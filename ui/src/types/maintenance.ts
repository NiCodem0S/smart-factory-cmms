import type { PagedResult } from './common'
import type { MachineStatus, TelemetrySource } from './machine'

export type WorkOrderStatus = 'Open' | 'InProgress' | 'Review' | 'Resolved'
export type WorkOrderStatusFilter = 'All' | WorkOrderStatus | 'Overdue' | 'DueToday'
export type WorkOrderType = 'Routine' | 'Predictive' | 'Critical'
export type ResolvedWindow = '24h' | '7d' | '30d' | 'all'

export interface MaintenanceWorkOrder {
    id: string
    ticketNumber: string
    title: string
    description: string | null
    type: WorkOrderType
    status: WorkOrderStatus
    machineId: string
    machineName: string
    machineSerialNumber: string | null
    machineStatus: MachineStatus
    factoryHallId: string
    factoryHallName: string
    productionLineName: string | null
    assignedUserId: string | null
    assigneeName: string | null
    createdAtUtc: string
    dueDateUtc: string | null
    resolvedAtUtc: string | null
    isOverdue: boolean
}

export interface MaintenanceSummary {
    total: number
    open: number
    inProgress: number
    review: number
    resolved: number
    overdue: number
    criticalOpen: number
    scheduledToday: number
}

export interface MaintenanceAssignee {
    userId: string
    fullName: string
    role: string
    factoryHallId: string | null
    activeWorkOrdersCount: number
}

export interface MaintenanceAttentionMachine {
    machineId: string
    machineName: string
    serialNumber: string | null
    status: MachineStatus
    telemetrySource: TelemetrySource
    factoryHallId: string
    factoryHallName: string
    productionLineName: string | null
    openWorkOrdersCount: number
}

export interface MaintenanceMachineOption {
    id: string
    name: string
    serialNumber: string | null
    status: MachineStatus
    factoryHallId: string
    factoryHallName: string
    productionLineName: string | null
}

export interface MaintenanceOverview {
    items: PagedResult<MaintenanceWorkOrder>
    summary: MaintenanceSummary
    assignees: MaintenanceAssignee[]
    attentionMachines: MaintenanceAttentionMachine[]
    generatedAtUtc: string
}

export interface FetchMaintenanceParams {
    page?: number
    pageSize?: number
    factoryHallId?: string | null
    status?: WorkOrderStatusFilter
    type?: WorkOrderType | 'All'
    assignedUserId?: string | null
    machineId?: string | null
    search?: string
    resolvedRange?: ResolvedWindow
}

export interface CreateMaintenanceWorkOrderPayload {
    machineId: string
    title: string
    description?: string | null
    type: WorkOrderType
    assignedUserId?: string | null
    dueDateUtc?: string | null
}

export interface PatchMaintenanceWorkOrderPayload {
    title?: string
    description?: string | null
    status?: WorkOrderStatus
    type?: WorkOrderType
    assignedUserId?: string | null
    clearAssignee?: boolean
    dueDateUtc?: string | null
    clearDueDate?: boolean
}
