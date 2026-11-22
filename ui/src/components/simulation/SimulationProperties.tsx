import { Zap } from 'lucide-react'
import type { SimulationMachine } from '../../types/simulation'

const numeric = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
export default function SimulationProperties({ machine, properties }: {
  machine: SimulationMachine | null, properties: Record<string, unknown>
}) {
  const profile = machine?.profile
  const other = Object.entries(properties).filter(([key]) => !['NormTemp', 'BaseVib', 'NormPower', 'Category'].includes(key))
  const rows = [
    ['Nominal temperature', numeric(profile?.normalTemperature), '°C'],
    ['Nominal vibration', numeric(profile?.baseVibration), 'mm/s'],
    ['Nominal power', numeric(profile?.normalPowerKw), 'kW'],
    ...other.map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value), '']),
  ]
  return <section className="rounded-xl bg-slate-900 p-5 text-slate-300 shadow-sm md:p-6">
    <div className="mb-5 flex items-center justify-between border-b border-slate-700 pb-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white"><Zap className="h-4 w-4 text-amber-400" />Specific Properties</h2>
      <span className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">JSON</span>
    </div>
    <dl className="space-y-4 text-sm">
      {rows.map(([label, value, unit]) => <div key={label} className="flex items-baseline justify-between gap-4">
        <dt className="text-slate-400">{label}</dt>
        <dd className="break-all text-right font-mono font-semibold text-white">{value}{unit && <span className="ml-1.5 text-xs font-normal text-slate-400">{unit}</span>}</dd>
      </div>)}
    </dl>
  </section>
}
