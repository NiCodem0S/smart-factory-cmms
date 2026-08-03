export type MachineStatus = 'Running' | 'Error' | 'Maintenance' | 'Offline'

export interface MachineListDto {
	id: string
	name: string
	category: string
	serialNumber: string
	status: MachineStatus
	installationDate: string
	activeWorkOrdersCount: number
	lastTelemetryRead: string | null
}

export interface TelemetryReadDto {
	id: string
	machineId: string
	temperature: number | null
	vibration: number | null
	powerLoadKw: number | null
	networkLatencyMs: number | null
	timestamp: string
}

export interface IncidentDto {
	id: string
	machineId: string
	triggeredAt: string
	message: string
	severity: string
	status: string
}

export interface AlertDto {
	id: string
	machineId: string
	severity: string
	message: string
	createdAt: string
	acknowledged: boolean
}

export interface MachineDetailDto {
	id: string
	name: string
	category: string
	serialNumber: string
	status: MachineStatus
	installationDate: string
	staticProperties: string | null
	isActive: boolean

	// Aggregated data
	totalWorkOrders: number
	openWorkOrders: number
	latestTelemetry: TelemetryReadDto[]
	recentIncidents: IncidentDto[]
	activeAlerts: AlertDto[]
}

export interface CreateMachineDto {
	name: string
	category: string
	serialNumber: string
	status: MachineStatus
}

export interface UpdateMachineDto {
	name: string
	category: string
	serialNumber: string | null
	status: MachineStatus
	isActive: boolean
}
