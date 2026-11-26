import type { PagedResult } from './common'
import type { MachineStatus } from './machine'

export type IncidentStatus = 'Active' | 'Acknowledged' | 'Resolved'
export type IncidentStatusFilter = 'All' | 'Open' | IncidentStatus
export type IncidentSeverity = 'Critical' | 'Warning'
export type IncidentRange = '24h' | '7d' | '30d' | 'all'

export interface IncidentHistoryItem {
    id: string
    machineId: string
    machineName: string
    machineSerialNumber: string | null
    machineCategory: string
    machineStatus: MachineStatus
    factoryHallId: string
    factoryHallName: string
    productionLineName: string | null
    triggeredAtUtc: string
    severity: string
    status: IncidentStatus
    message: string
    openWorkOrdersCount: number
}

export interface IncidentHistorySummary {
    total: number
    active: number
    acknowledged: number
    resolved: number
    criticalOpen: number
    warningOpen: number
}

export interface IncidentActivityBucket {
    label: string
    startUtc: string
    criticalCount: number
    warningCount: number
}

export interface IncidentHotspot {
    machineId: string
    machineName: string
    productionLineName: string | null
    totalCount: number
    criticalCount: number
}

export interface IncidentHistoryResponse {
    items: PagedResult<IncidentHistoryItem>
    summary: IncidentHistorySummary
    activity: IncidentActivityBucket[]
    hotspots: IncidentHotspot[]
    generatedAtUtc: string
}

export interface FetchIncidentsParams {
    page?: number
    pageSize?: number
    factoryHallId?: string | null
    machineId?: string | null
    status?: IncidentStatusFilter
    severity?: IncidentSeverity | 'All'
    range?: IncidentRange
    search?: string
    includeInsights?: boolean
}
