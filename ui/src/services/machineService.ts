import { apiClient } from './apiClient'
import { MachineListDto, MachineStatus } from '../types/machine'
import { PagedResult } from '../types/common'

export async function fetchMachines(
	page: number = 1,
	pageSize: number = 10,
	search?: string,
	status?: MachineStatus,
): Promise<PagedResult<MachineListDto>> { // : return type
	const response = await apiClient.get<PagedResult<MachineListDto>>('/Machines', {
		params: {
			page,
			pageSize,
			search: search || undefined,
			status: status || undefined,
		},
	})

	return response.data
}
