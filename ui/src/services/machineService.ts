import { apiClient } from './apiClient'
import { MachineListDto, MachineStatus, MachineDetailDto, CreateMachineDto, UpdateMachineDto, MachineProductionLineDto } from '../types/machine'
import { PagedResult } from '../types/common'

export async function fetchMachines(
	page: number = 1,
	pageSize: number = 10,
	search?: string,
	status?: MachineStatus,
	signal?: AbortSignal,
): Promise<PagedResult<MachineListDto>> { // : return type
	const response = await apiClient.get<PagedResult<MachineListDto>>('/Machines', {
		params: {
			page,
			pageSize,
			search: search || undefined,
			status: status || undefined,
		},
		signal
	})

	return response.data
}

export async function fetchMachinesById(
	id: string,
	signal?: AbortSignal
): Promise<MachineDetailDto> {
	const response = await apiClient.get<MachineDetailDto>(`/Machines/${id}`, {
		params: {},
		signal
	})
	return response.data
}

export async function fetchMachinesByProdLineId(
	id: string,
	signal?: AbortSignal
): Promise<MachineProductionLineDto[]> {
	const response = await apiClient.get<MachineProductionLineDto[]>(`/ProductionLines/${id}/Machines`, {
		params: {},
		signal
	})
	return response.data
}

export async function createMachine(
	dto: CreateMachineDto,
): Promise<MachineDetailDto> {
	const response = await apiClient.post<MachineDetailDto>('/Machines', dto)

	return response.data
}

export async function updateMachine(
	id: string,
	dto: UpdateMachineDto
): Promise<void> {
	await apiClient.put(`/Machines/${id}`, dto)
}

