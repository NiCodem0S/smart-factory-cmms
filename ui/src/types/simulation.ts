import type { MachineStatus } from './machine'

export type SimulationPreset = 'Stable' | 'WearAndTear' | 'Chaos' | 'Custom'
export type SimulationScenario = 'Normal' | 'TemperatureWarning' | 'Overheating' | 'ExcessVibration' | 'Failure'
export interface SimulationParameters {
  tickIntervalMs: number
  ambientTemperature: number
  normalTemperature: number
  temperatureNoiseAmplitude: number
  temperatureResponsePerSecond: number
  overheatingDegreesPerSecond: number
  coolingDegreesPerSecond: number
  baseVibration: number
  vibrationNoiseAmplitude: number
  excessVibrationAmplitude: number
  normalPowerKw: number
  powerNoiseAmplitudeKw: number
  idlePowerKw: number
  overheatingProbabilityPerHour: number
  excessVibrationProbabilityPerHour: number
  failureProbabilityPerHour: number
  wearPerHour: number
}
export interface SimulationProfile extends SimulationParameters {
  machineId: string
  preset: SimulationPreset
  version: number
  createdAtUtc: string
  updatedAtUtc: string
}
export interface MachineSimState {
  schemaVersion: number
  machineId: string
  tickNumber: number
  profileVersion: number
  lastTickAtUtc: string
  machineStatus: MachineStatus
  totalProduced: number
  temperature: number
  vibration: number
  powerLoadKw: number
  cycleProgressSeconds: number
  wear: number
  isOverheating: boolean
  isOvervibrating: boolean
  faultMode: string
}
export interface SimulationMachine {
  machineId: string
  name: string
  factoryHallId: string
  productionLineId: string | null
  machineStatus: MachineStatus
  simulationEnabled: boolean
  workerStatus: string
  lastError: string | null
  state: MachineSimState | null
  stateAgeSeconds: number | null
  profile: SimulationProfile | null
  lineStatus: string | null
  automationEnabled: boolean
  automaticRepairAtUtc: string | null
}
export interface SimulationAutomation {
  enabled: boolean
  healthyLinesInView: number
  pendingRepairsInView: number
  repairMinSeconds: number
  repairMaxSeconds: number
  warning: string | null
}
export interface SimulationList {
  redisAvailable: boolean
  serviceError: string | null
  machines: SimulationMachine[]
  droppedHistorySamples: number
  persistedHistorySamples: number
  persistenceErrors: number
  historyQueueLength: number
  lastHistoryWriteAtUtc: string | null
  lastHistoryError: string | null
  automation: SimulationAutomation
}
