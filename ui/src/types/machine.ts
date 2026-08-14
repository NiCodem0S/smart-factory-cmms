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
	totalOperatingHours: number
	lastStatusChangedAt: string | null
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
	totalOperatingHours: number
	lastStatusChangedAt: string | null

	// Production Tracking
	icon: string
	totalProduced: number
	cycleTimeSeconds: number
	orderInLine: number

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
	cycleTimeSeconds: number
	orderInLine: number
	icon?: string
	factoryHallId: string
	productionLineId: string | null
	normTemp: number
	baseVib: number
	normPower: number
	alertThresholds: {
		metricType: string;
		warningValue: number;
		criticalValue: number;
	}[];
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

export interface AlertThresholdsDto {
	id: string,
	machineId: string,
	metricType: string,
	warningValue: number,
	criticalValue: number
}

export interface CreateAlertThresholdsDto {
	metricType: string,
	warningValue: number,
	criticalValue: number
}

export interface UpdateMachineDto {
	name: string
	category: string
	serialNumber: string | null
	status: MachineStatus
	cycleTimeSeconds: number
	orderInLine: number
	icon?: string
	factoryHallId: string
	productionLineId: string | null
	normTemp: number
	baseVib: number
	normPower: number
}
