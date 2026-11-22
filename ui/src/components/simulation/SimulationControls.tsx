import { useState } from 'react'
import { Check, Loader2, Pause, Play, Power, ShieldCheck, Wrench, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { simulationError, simulationService } from '../../services/simulationService'
import { haltLineById, startLineById } from '../../services/productionLinesService'
import type { SimulationMachine, SimulationScenario } from '../../types/simulation'

const scenarios: { value: SimulationScenario, label: string, description: string }[] = [
  { value: 'Normal', label: 'Normal operation', description: 'Restore normal targets and clear disturbances. Production count and wear are preserved. Existing faults require a repair.' },
  { value: 'TemperatureWarning', label: 'Temperature warning', description: 'Inject a temperature between the warning and critical limits. The machine then returns toward its normal temperature.' },
  { value: 'Overheating', label: 'Progressive overheating', description: 'Begin above the temperature warning limit and keep heating at the profile rate until a critical fault stops the line.' },
  { value: 'ExcessVibration', label: 'Critical vibration', description: 'Inject a vibration spike above the critical limit. The drive stops immediately; the peak is saved in telemetry and incidents.' },
  { value: 'Failure', label: 'Machine failure', description: 'Trigger an immediate fault and halt the line. Recovery requires maintenance and a completed repair.' },
]
export default function SimulationControls({ machine, onChange, disabled = false }: {
  machine: SimulationMachine, onChange: () => void, disabled?: boolean
}) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [scenario, setScenario] = useState<SimulationScenario>('Normal')
  if (user?.role !== 'SuperAdmin' && user?.role !== 'HallAdmin') return null

  async function run(operation: () => Promise<unknown>, message?: string) {
    setBusy(true); setError(null); setNotice(null)
    try { await operation(); onChange(); if (message) setNotice(message) }
    catch (e) { setError(simulationError(e)) }
    finally { setBusy(false) }
  }
  const action = (kind: 'start' | 'stop' | 'maintenance' | 'repair', operational: boolean) =>
    run(() => simulationService.action(machine.machineId, kind, operational))
  const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold transition hover:border-violet-300 hover:bg-violet-50/50 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 disabled:cursor-not-allowed'
  const running = machine.workerStatus === 'Running'
  const ready = machine.machineStatus === 'Running' || machine.machineStatus === 'Warning'
  const lineProducing = machine.lineStatus === 'Running' || machine.lineStatus === 'Warning'
  const producing = !machine.productionLineId || lineProducing
  const requiresProduction = scenario !== 'Normal' && scenario !== 'Failure'
  const selected = scenarios.find(s => s.value === scenario)!
  return <div className="space-y-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Machine controls</p>
    <div className="grid grid-cols-2 gap-2">
      {machine.machineStatus === 'Offline' ?
        <button className={button + ' text-emerald-700'} disabled={busy || disabled} onClick={() => void action('start', true)}><Play className="h-3.5 w-3.5 shrink-0" />Start machine</button> :
        <button className={button + ' text-slate-600'} disabled={busy || machine.machineStatus === 'Error' || machine.machineStatus === 'Maintenance'} onClick={() => void action('stop', true)}><Power className="h-3.5 w-3.5 shrink-0" />Switch off machine</button>}
      <button className={button} title={!ready && !running ? 'Start a healthy machine first.' : ''}
        disabled={busy || (!running && (!ready || disabled))}
        onClick={() => void action(running ? 'stop' : 'start', false)}>
        {running ? <Pause className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Play className="h-3.5 w-3.5 shrink-0 text-violet-500" />}{running ? 'Pause simulation' : 'Start simulation'}
      </button>
      {machine.machineStatus === 'Maintenance' ?
        <button className={button + ' text-emerald-700'} disabled={busy} onClick={() => void action('repair', true)}><ShieldCheck className="h-3.5 w-3.5 shrink-0" />Complete repair</button> :
        <button className={button + ' text-violet-600'} disabled={busy} onClick={() => void action('maintenance', true)}><Wrench className="h-3.5 w-3.5 shrink-0" />Enter maintenance</button>}
      {machine.productionLineId && <button className={button + ' text-blue-700'} disabled={busy || disabled || (!lineProducing && (!running || !ready))}
        onClick={() => void run(() => lineProducing ? haltLineById(machine.productionLineId!) : startLineById(machine.productionLineId!))}>
        {lineProducing ? <Pause className="h-3.5 w-3.5 shrink-0" /> : <Play className="h-3.5 w-3.5 shrink-0" />}{lineProducing ? 'Halt production line' : 'Start production line'}
      </button>}
    </div>
    {machine.machineStatus === 'Offline' && <p className="text-xs text-slate-500">Starting the machine also starts its simulation. Start its production line separately.</p>}
    <fieldset disabled={busy || disabled || !running || !ready} className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3.5 disabled:opacity-60">
      <label className="flex items-center gap-2 text-xs font-bold text-violet-800" htmlFor={`scenario-${machine.machineId}`}><Zap className="h-3.5 w-3.5" />Trigger a simulation scenario</label>
      <div className="space-y-2">
        <select id={`scenario-${machine.machineId}`} value={scenario} onChange={e => { setScenario(e.target.value as SimulationScenario); setNotice(null) }}
          className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-violet-400">
          {scenarios.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={requiresProduction && !producing}
          onClick={() => void run(() => simulationService.scenario(machine.machineId, scenario), `${selected.label} triggered.`)}><Zap className="h-3.5 w-3.5" />Trigger scenario</button>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{selected.description}</p>
    </fieldset>
    {ready && requiresProduction && !producing && <p className="text-xs text-amber-700">Start production to trigger temperature or vibration scenarios.</p>}
    {machine.machineStatus === 'Error' && <p className="text-xs text-amber-700">Faults stay active until you enter maintenance and complete the repair. Restart the machine and line afterwards.</p>}
    {busy && <p role="status" className="flex items-center gap-2 text-xs text-violet-600"><Loader2 className="h-3 w-3 animate-spin" />Saving…</p>}
    {notice && <p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />{notice}</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>
}
