import { apiClient } from './apiClient'
import { MachineListDto, MachineStatus } from '../types/machine'
import { PagedResult } from '../types/common'

export async function fetchMachines(
	page: number = 1,
	pageSize: number = 10,
	search?: string,
	status?: MachineStatus,
): Promise<PagedResult<MachineListDto>> {
	const response = await apiClient.get<PagedResult<MachineListDto>>('/machines', {
		params: { page, pageSize, search, status },
	})

	return response.data
}
