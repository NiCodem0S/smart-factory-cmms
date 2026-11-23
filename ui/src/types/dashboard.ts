import type { MachineStatus } from './machine'

export interface DashboardTelemetry {
    timestampUtc: string
    temperature: number | null
    vibration: number | null
    powerLoadKw: number | null
    networkLatencyMs: number | null
}

export interface DashboardMachine {
    id: string
    name: string
    category: string
    serialNumber: string | null
    factoryHallId: string
    factoryHallName: string
    productionLineId: string | null
    productionLineName: string | null
    orderInLine: number
    status: MachineStatus
    totalProduced: number
    latestTelemetry: DashboardTelemetry | null
    totalOperatingHours?: number
    cycleTimeSeconds?: number
}

export interface DashboardIncident {
    id: string
    machineId: string
    machineName: string
    factoryHallId: string
    triggeredAtUtc: string
    severity: string
    status: string
    message: string
}

export interface DashboardProductionLine {
    id: string
    name: string
    status: string
    factoryHallId: string
    factoryHallName: string
    orderInHall: number | null
    lastStatusChangedAtUtc: string | null
    productName: string | null
    productSku: string | null
}

export interface DashboardWorkOrder {
    id: string
    ticketNumber: string
    machineId: string
    machineName: string
    factoryHallId: string
    title: string
    type: string
    status: string
    assignedUserId: string | null
    assigneeName: string | null
    createdAtUtc: string
    dueDateUtc: string | null
}

export interface DashboardThreshold {
    machineId: string
    metricType: string
    warningValue: number
    criticalValue: number
}

export interface DashboardShift {
    name: string
    startTime: string
    endTime: string
    progressPercent: number
}

export interface DashboardSummary {
    totalMachines: number
    runningMachines: number
    warningMachines: number
    errorMachines: number
    maintenanceMachines: number
    offlineMachines: number
    activeCriticalIncidents: number
    totalProduced: number
    powerLoadKw: number | null
    averageLatencyMs: number | null
    machinesWithPowerReadings: number
}

export interface DashboardSnapshot {
    generatedAtUtc: string
    factoryHallId: string | null
    hallIds: string[]
    machines: DashboardMachine[]
    incidents: DashboardIncident[]
    summary: DashboardSummary
    productionLines?: DashboardProductionLine[]
    workOrders?: DashboardWorkOrder[]
    thresholds?: DashboardThreshold[]
    peakPowerLimitKw?: number
    currentShift?: DashboardShift | null
    siteName?: string
}
