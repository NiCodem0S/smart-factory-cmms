import axios from 'axios'
import { apiClient } from './apiClient'
import type { SimulationList, SimulationMachine, SimulationParameters, SimulationPreset, SimulationProfile, SimulationScenario } from '../types/simulation'

export function simulationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data?.errors) return Object.values(data.errors).flat().join(' ')
    return data?.message ?? data?.detail ?? error.message
  }
  return error instanceof Error ? error.message : 'The operation could not be completed.'
}
export const simulationService = {
  automation: (enabled: boolean) => apiClient.put('/simulation/automation', { enabled }),
  list: async (hallId?: string | null) => (await apiClient.get<SimulationList>('/simulation', { params: hallId ? { hallId } : {} })).data,
  state: async (id: string) => (await apiClient.get<SimulationMachine>(`/simulation/${id}/state`)).data,
  profile: async (id: string) => (await apiClient.get<SimulationProfile>(`/simulation/${id}/profile`)).data,
  saveProfile: (id: string, parameters: SimulationParameters, version: number) => apiClient.put(`/simulation/${id}/profile`, { ...parameters, version }),
  preset: (id: string, preset: SimulationPreset, version: number) => apiClient.post(`/simulation/${id}/preset`, { preset, version }),
  scenario: (id: string, scenario: SimulationScenario) => apiClient.post(`/simulation/${id}/scenario`, { scenario }),
  action: (id: string, action: 'start' | 'stop' | 'maintenance' | 'repair', machine = false) =>
    apiClient.post(`/${machine ? 'machines' : 'simulation'}/${id}/${action}`),
}
