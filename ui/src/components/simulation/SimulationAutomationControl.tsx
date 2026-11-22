import { useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { simulationError, simulationService } from '../../services/simulationService'
import type { SimulationAutomation } from '../../types/simulation'

export default function SimulationAutomationControl({ automation, onChange }: { automation: SimulationAutomation, onChange: () => void }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function toggle() {
    setBusy(true); setError(null)
    try { await simulationService.automation(!automation.enabled); onChange() }
    catch (e) { setError(simulationError(e)) }
    finally { setBusy(false) }
  }
  return <section className={`rounded-2xl border bg-white p-4 shadow-sm ${automation.enabled ? 'border-emerald-200' : 'border-slate-200'}`}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3"><span className={`rounded-xl p-2.5 ${automation.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><RotateCcw className="h-4 w-4" /></span><div>
        <h2 className="text-sm font-bold text-slate-800">Automatic line recovery <span className={`ml-2 rounded-md px-2 py-0.5 text-[10px] ${automation.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{automation.enabled ? 'Active' : 'Paused'}</span></h2>
        <p className="mt-1 text-xs text-slate-500">Keeps a green line running across the factory. Every line can fail; another takes over.</p>
        <p className="mt-2 text-[10px] text-slate-400">Routine repair delay: {automation.repairMinSeconds}–{automation.repairMaxSeconds}s · Recovery takes priority when no line is green.</p>
      </div></div>
      <div className="flex flex-wrap items-center gap-4 text-xs"><span className="text-slate-400"><strong className="text-emerald-600">{automation.healthyLinesInView}</strong> green in this view</span><span className="text-slate-400"><strong className="text-blue-600">{automation.pendingRepairsInView}</strong> queued repairs</span>
        {user?.role === 'SuperAdmin' && <button onClick={() => void toggle()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">{automation.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{busy ? 'Saving…' : automation.enabled ? 'Pause auto recovery' : 'Enable auto recovery'}</button>}
      </div>
    </div>
    {(error || automation.warning) && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{error || automation.warning}</p>}
  </section>
}
