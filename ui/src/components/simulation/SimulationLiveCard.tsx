import { useEffect, useState } from 'react'
import { Activity, Cpu, Factory, Gauge, Package, Radio, RotateCcw, Thermometer, Waves, Zap } from 'lucide-react'
import type { SimulationMachine } from '../../types/simulation'
import SimulationControls from './SimulationControls'
import TelemetryHistoryChart from './TelemetryHistoryChart'
import { simulationMode } from '../../utils/simulationMode'

export function SimulationReadStatus({ machine, connectionStatus }: { machine: SimulationMachine, connectionStatus: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const age = machine.state ? Math.max(0, (now - Date.parse(machine.state.lastTickAtUtc)) / 1000) : null
  const stale = machine.state && (machine.workerStatus !== 'Running' || age! > Math.max(10, (machine.profile?.tickIntervalMs ?? 1000) / 1000 * 3))
  return <div className="space-y-2">
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500"><Radio className={`h-3 w-3 ${connectionStatus === 'Live' ? 'text-emerald-500' : 'text-amber-500'}`} />{connectionStatus}<span className="text-slate-300">/</span>{age === null ? 'No reading' : `Updated ${Math.floor(age)}s ago`}</p>
    {stale && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Last saved snapshot. Current machine operation is not confirmed.</p>}
  </div>
}
export function SimulationStatusPanel({ machine, connectionStatus, onChange }: {
  machine: SimulationMachine, connectionStatus: string, onChange: () => void
}) {
  const mode = simulationMode(machine)
  const producing = mode.label === 'Producing'
  const fault = machine.machineStatus === 'Error'
  const tone = producing ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : fault ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'
  const items = [
    { label: 'Machine', value: machine.machineStatus, icon: Factory, good: machine.machineStatus === 'Running' },
    { label: 'Simulation', value: machine.simulationEnabled ? 'Enabled' : 'Disabled', icon: Activity, good: machine.simulationEnabled },
    { label: 'Worker', value: machine.workerStatus, icon: Cpu, good: machine.workerStatus === 'Running' },
    { label: 'Line', value: machine.lineStatus ?? 'Standalone', icon: Gauge, good: machine.lineStatus === 'Running' },
  ]
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h2 className="mb-2 text-sm font-bold text-slate-900">Runtime overview</h2><SimulationReadStatus machine={machine} connectionStatus={connectionStatus} /></div><span className="rounded-xl bg-violet-50 p-2 text-violet-500"><Cpu className="h-4 w-4" /></span></div>
    <dl className="grid grid-cols-2 gap-2">
      {items.map(({ label, value, icon: Icon, good }) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
        <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400"><Icon className="h-3 w-3" />{label}</dt>
        <dd className={`mt-1 text-xs font-semibold ${good ? 'text-emerald-700' : value === 'Error' || value === 'Faulted' ? 'text-rose-600' : 'text-slate-700'}`}>{value}</dd>
      </div>)}
    </dl>
    <div className={`rounded-xl border p-3.5 ${tone}`}>
      <p className="flex items-center gap-2 text-sm font-bold"><span className={`h-2 w-2 rounded-full ${producing ? 'bg-emerald-500' : fault ? 'bg-rose-500' : 'bg-amber-500'}`} />{mode.label}</p>
      <p className="mt-2 text-xs leading-relaxed opacity-85">{mode.description}</p>
      {!producing && machine.profile && <p className="mt-2 border-t border-current/10 pt-2 font-mono text-[10px] opacity-70">Idle: {machine.profile.ambientTemperature} °C · 0 mm/s · {machine.profile.idlePowerKw} kW</p>}
    </div>
    {machine.lastError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{machine.lastError}</p>}
    {machine.automationEnabled && <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700"><RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p><strong>Auto recovery active.</strong> {machine.automaticRepairAtUtc ? `Repair scheduled for ${new Date(machine.automaticRepairAtUtc).toLocaleTimeString('en-GB')}.` : 'The factory may start or repair a line to keep production running.'}</p></div>}
    <SimulationControls machine={machine} onChange={onChange} disabled={machine.workerStatus === 'Unavailable'} />
  </section>
}
export function SimulationLiveCard({ machine, connectionStatus, onChange }: {
  machine: SimulationMachine, connectionStatus: string, onChange: () => void
}) {
  const state = machine.state
  const numeric = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  const metrics = [
    { label: 'Temperature', value: numeric(state?.temperature), unit: '°C', icon: Thermometer, tone: 'bg-rose-50 text-rose-500' },
    { label: 'Vibration', value: numeric(state?.vibration), unit: 'mm/s', icon: Waves, tone: 'bg-violet-50 text-violet-500' },
    { label: 'Power load', value: numeric(state?.powerLoadKw), unit: 'kW', icon: Zap, tone: 'bg-amber-50 text-amber-500' },
    { label: 'Produced', value: numeric(state?.totalProduced), unit: 'parts', icon: Package, tone: 'bg-blue-50 text-blue-500' },
  ]
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
      {metrics.map(({ label, value, unit, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-slate-500">{label}</p><span className={`rounded-lg p-1.5 ${tone}`}><Icon className="h-3.5 w-3.5" /></span></div>
        <p className="text-xl font-bold tabular-nums text-slate-800">{value}<span className="ml-1.5 text-xs font-medium text-slate-400">{unit}</span></p>
      </div>)}
    </div>
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <TelemetryHistoryChart machineId={machine.machineId} state={state} tickIntervalMs={machine.profile?.tickIntervalMs} connectionStatus={connectionStatus} />
      <SimulationStatusPanel machine={machine} connectionStatus={connectionStatus} onChange={onChange} />
    </div>
  </div>
}
