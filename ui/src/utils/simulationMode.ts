import type { SimulationMachine } from '../types/simulation'

export function simulationMode(machine: SimulationMachine) {
  if (machine.machineStatus === 'Maintenance') return { label: 'Maintenance', description: 'The machine is under maintenance. Complete the repair before starting it.' }
  if (machine.machineStatus === 'Offline') return { label: 'Offline', description: 'Start the machine to enable live telemetry.' }
  if (machine.workerStatus !== 'Running' || !machine.simulationEnabled || !machine.state)
    return { label: 'Simulation paused', description: 'Readings are the last saved snapshot. Start or restore the simulation to resume updates.' }
  if (machine.machineStatus === 'Error') return { label: 'Fault / cooling', description: 'The drive has stopped after a fault. Temperature moves toward ambient; vibration is zero and power is at the idle level. Enter maintenance and complete the repair.' }
  if (machine.productionLineId && machine.lineStatus !== 'Running' && machine.lineStatus !== 'Warning')
    return { label: 'Idle — line halted', description: 'The machine is ready, but its line is halted. It cools toward ambient, with zero vibration and idle power. Start all machines on the line, then start the line to produce.' }
  return { label: 'Producing', description: 'The machine is under load. Readings follow the active profile, with noise, wear and any triggered disturbances.' }
}
