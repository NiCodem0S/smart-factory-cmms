import { useEffect, useState } from 'react'
import { Check, Save, SlidersHorizontal } from 'lucide-react'
import { simulationError, simulationService } from '../../services/simulationService'
import type { SimulationParameters, SimulationPreset, SimulationProfile } from '../../types/simulation'

const fields: { key: keyof SimulationParameters, label: string, min: number, max?: number, step?: number }[] = [
  { key: 'tickIntervalMs', label: 'Simulation tick (ms)', min: 100, max: 60000, step: 1 },
  { key: 'ambientTemperature', label: 'Ambient temperature (°C)', min: -273.15, max: 2000 },
  { key: 'normalTemperature', label: 'Nominal temperature (°C)', min: -273.15, max: 2000 },
  { key: 'temperatureNoiseAmplitude', label: 'Temperature noise (°C)', min: 0 },
  { key: 'temperatureResponsePerSecond', label: 'Temperature response rate (1/s)', min: 0 },
  { key: 'overheatingDegreesPerSecond', label: 'Heating rate during overheating (°C/s)', min: 0.001 },
  { key: 'coolingDegreesPerSecond', label: 'Cooling rate (°C/s)', min: 0.001 },
  { key: 'baseVibration', label: 'Nominal vibration (mm/s)', min: 0 },
  { key: 'vibrationNoiseAmplitude', label: 'Vibration noise (mm/s)', min: 0 },
  { key: 'excessVibrationAmplitude', label: 'Additional vibration during a fault (mm/s)', min: 0 },
  { key: 'normalPowerKw', label: 'Nominal power (kW)', min: 0 },
  { key: 'powerNoiseAmplitudeKw', label: 'Power noise (kW)', min: 0 },
  { key: 'idlePowerKw', label: 'Idle power (kW)', min: 0 },
  { key: 'overheatingProbabilityPerHour', label: 'Overheating probability per hour (0–1)', min: 0, max: 1 },
  { key: 'excessVibrationProbabilityPerHour', label: 'Excess vibration probability per hour (0–1)', min: 0, max: 1 },
  { key: 'failureProbabilityPerHour', label: 'Failure probability per hour (0–1)', min: 0, max: 1 },
  { key: 'wearPerHour', label: 'Wear increase per hour (0–1)', min: 0, max: 1 },
]
const groups = [
  { label: 'Timing & environment', fields: fields.slice(0, 2) },
  { label: 'Temperature', fields: fields.slice(2, 7) },
  { label: 'Vibration', fields: fields.slice(7, 10) },
  { label: 'Power consumption', fields: fields.slice(10, 13) },
  { label: 'Reliability & wear', fields: fields.slice(13) },
]
const presets = [
  { value: 'Stable', label: 'Stable', hint: 'Steady operation', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'WearAndTear', label: 'Wear & tear', hint: 'Gradual degradation', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'Chaos', label: 'Chaos', hint: 'Frequent disturbances', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
] as const
export default function SimulationProfileEditor({ machineId, serverVersion, onChange }: {
  machineId: string, serverVersion?: number, onChange: () => void
}) {
  const [form, setForm] = useState<SimulationProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    setForm(null); setError(null)
    simulationService.profile(machineId).then(p => { if (active) setForm(p) }).catch(e => { if (active) setError(simulationError(e)) })
    return () => { active = false }
  }, [machineId])
  async function reload() { setForm(await simulationService.profile(machineId)) }
  async function submit(preset?: SimulationPreset) {
    if (!form) return
    setBusy(true); setError(null); setSaved(false)
    try {
      if (!fields.every(f => Number.isFinite(form[f.key]))) throw new Error('Complete all numeric values.')
      if (preset) await simulationService.preset(machineId, preset, form.version)
      else await simulationService.saveProfile(machineId, form, form.version)
      await reload(); onChange(); setSaved(true)
    } catch (e) { setError(simulationError(e)) }
    finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2 text-violet-500"><SlidersHorizontal className="h-4 w-4" /></span><h2 className="text-base font-bold text-slate-800">Simulation Profile</h2></div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">Tune machine behaviour or start with a preset. Changes apply to the running simulation.</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {form && <>
      <div className="my-5 grid grid-cols-3 gap-2">
        {presets.map(p => <button key={p.value} disabled={busy} onClick={() => void submit(p.value)} aria-pressed={form.preset === p.value}
          className={`rounded-xl border px-2 py-3 text-left transition hover:-translate-y-0.5 disabled:opacity-50 motion-reduce:transform-none ${p.tone} ${form.preset === p.value ? 'ring-1 ring-current' : ''}`}>
          <span className="block text-xs font-bold">{p.label}</span><span className="mt-1 block text-[10px] leading-relaxed opacity-70">{p.hint}</span>
        </button>)}
      </div>
      <p className="mb-5 flex items-center justify-between text-[11px] text-slate-400"><span>Active preset <strong className="ml-1 text-violet-600">{form.preset}</strong></span><span className="font-mono">v{form.version}</span></p>
      {serverVersion !== undefined && serverVersion !== form.version && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-800">
        The profile has changed. <button className="underline" onClick={() => void reload().catch(e => setError(simulationError(e)))}>Reload the current profile</button> before saving your changes.
      </p>}
      <form onSubmit={e => { e.preventDefault(); void submit() }}>
        <fieldset disabled={busy} className="space-y-5">
          {groups.map(group => <div key={group.label}>
            <h3 className="mb-3 border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {group.fields.map(field => <label key={field.key} className="text-[11px] font-medium leading-relaxed text-slate-600">
            {field.label}
            <input type="number" required min={field.min} max={field.max} step={field.step ?? 'any'} value={Number.isNaN(form[field.key]) ? '' : form[field.key]}
              onChange={e => { setSaved(false); setForm({ ...form, [field.key]: e.target.value === '' ? NaN : Number(e.target.value) }) }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm tabular-nums text-slate-900 transition focus:border-violet-400 focus:bg-white focus:outline-violet-400" />
          </label>)}
            </div>
          </div>)}
        </fieldset>
        <div className="sticky bottom-0 mt-5 flex items-center gap-3 border-t border-slate-100 bg-white/95 pb-1 pt-4 backdrop-blur">
          <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{busy ? 'Saving…' : 'Save profile'}</button>
          {saved && <span role="status" className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />Profile saved.</span>}
        </div>
      </form>
    </>}
    {!form && !error && <p className="mt-4 text-sm text-slate-500">Loading profile…</p>}
  </section>
}
