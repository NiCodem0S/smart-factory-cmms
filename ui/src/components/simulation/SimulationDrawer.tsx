import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, FlaskConical, SlidersHorizontal, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { SimulationMachine } from '../../types/simulation'
import { SimulationStatusPanel } from './SimulationLiveCard'
import SimulationProfileEditor from './SimulationProfileEditor'

export default function SimulationDrawer({ machine, connectionStatus, onChange }: {
  machine: SimulationMachine, connectionStatus: string, onChange: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'controls' | 'profile'>('controls')
  const [profileVisited, setProfileVisited] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const canManage = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin'
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    else if (!open && element.open) element.close()
  }, [open])
  return createPortal(<>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open machine simulation" aria-haspopup="dialog" aria-expanded={open}
      className="fixed bottom-5 right-5 z-[110] flex items-center gap-3 rounded-2xl border border-violet-400/25 bg-slate-900 px-4 py-3 text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 motion-reduce:transform-none sm:bottom-6 sm:right-6">
      <span className="relative rounded-xl bg-violet-500/20 p-2"><FlaskConical className="h-5 w-5 text-violet-300" /><span className={`absolute right-0 top-0 h-2 w-2 rounded-full ring-2 ring-slate-900 ${machine.workerStatus === 'Running' ? 'bg-emerald-400' : 'bg-slate-400'}`} /></span>
      <span className="text-left"><span className="block text-sm font-semibold">Simulation</span><span className="block text-[10px] tracking-wide text-slate-400">CONTROL PANEL</span></span>
      <SlidersHorizontal className="ml-2 h-4 w-4 text-slate-400" />
    </button>
    <dialog ref={dialog} aria-labelledby="simulation-drawer-title" onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}
      className="simulation-drawer fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[500px] border-0 bg-slate-50 p-0 text-slate-800 shadow-2xl">
      <div className="flex h-full flex-col">
        <header className="shrink-0 bg-slate-900 px-5 pb-5 pt-6 text-white sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-violet-300"><FlaskConical className="h-4 w-4" />Simulation tools</span>
            <button onClick={() => setOpen(false)} aria-label="Close simulation panel" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300"><X className="h-5 w-5" /></button>
          </div>
          <h2 id="simulation-drawer-title" className="text-xl font-bold">Machine Simulation</h2>
          <p className="mt-1 truncate text-sm text-slate-400">{machine.name}</p>
          {canManage && <div className="mt-5 flex gap-1 rounded-xl bg-white/5 p-1" aria-label="Simulation panel view">
            {(['controls', 'profile'] as const).map(item => <button key={item} aria-pressed={view === item}
              onClick={() => { setView(item); if (item === 'profile') setProfileVisited(true) }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${view === item ? 'bg-violet-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              {item === 'controls' ? 'Machine controls' : 'Simulation profile'}
            </button>)}
          </div>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div hidden={view !== 'controls'}><SimulationStatusPanel machine={machine} connectionStatus={connectionStatus} onChange={onChange} /></div>
          {canManage && profileVisited && <div hidden={view !== 'profile'}><SimulationProfileEditor machineId={machine.machineId} serverVersion={machine.profile?.version} onChange={onChange} /></div>}
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
          <Link to={`/simulation?machineId=${machine.machineId}`} onClick={() => setOpen(false)} className="flex items-center justify-between text-xs font-semibold text-violet-600 hover:text-violet-800">Open simulation workspace<ArrowUpRight className="h-4 w-4" /></Link>
        </footer>
      </div>
    </dialog>
  </>, document.body)
}
