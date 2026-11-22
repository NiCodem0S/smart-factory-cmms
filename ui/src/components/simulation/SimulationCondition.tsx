import type { SimulationMachine } from '../../types/simulation'

export default function SimulationCondition({ machine }: { machine: SimulationMachine | null }) {
  const wear = machine?.state?.wear
  const remaining = wear === undefined ? null : Math.round((1 - wear) * 100)
  const fault = machine?.machineStatus === 'Error'
  const color = fault ? '#ef4444' : remaining !== null && remaining < 30 ? '#f59e0b' : '#22c55e'
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-800">Simulation Condition</h2>
    <div className="grid items-center gap-6 md:grid-cols-[180px_1fr]">
      <div>
        <div className="relative h-[90px] w-[180px] overflow-hidden">
          <div className="absolute h-[180px] w-[180px] rounded-full" style={{ background: `conic-gradient(from 270deg, ${color} 0deg, ${color} ${(remaining ?? 0) * 1.8}deg, #f1f5f9 ${(remaining ?? 0) * 1.8}deg, #f1f5f9 180deg, transparent 180deg)` }} />
          <div className="absolute left-[15px] top-[15px] h-[150px] w-[150px] rounded-full bg-white" />
          <div className="absolute bottom-0 w-full text-center text-4xl font-black" style={{ color }}>{remaining === null ? '—' : `${remaining}%`}</div>
        </div>
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">Remaining wear budget</p>
      </div>
      <div className="space-y-3 text-sm">
        <p className={`font-semibold ${fault ? 'text-red-600' : 'text-slate-800'}`}>Status: {machine?.machineStatus ?? 'Unavailable'} · Fault: {machine?.state?.faultMode ?? 'Unknown'}</p>
        <p className="text-xs leading-relaxed text-slate-500">Wear comes from the simulation state. It increases during production according to the profile and resets after a completed repair. This is a simulated wear indicator; a failure can occur at any wear level.</p>
        <p className="text-xs text-slate-500">Predictive remaining useful life is not available.</p>
      </div>
    </div>
  </section>
}
