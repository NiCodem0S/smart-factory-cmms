import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
    Activity,
    ArrowUpRight,
    Cpu,
    Database,
    FlaskConical,
    Layers,
    RefreshCw,
    Search,
    SlidersHorizontal,
    TriangleAlert,
    Waves,
} from 'lucide-react'
import Header from '../layout/Header'
import { useFactory } from '../../context/FactoryContext'
import { useAuth } from '../../context/AuthContext'
import { useTelemetrySubscription } from '../../hooks/useTelemetrySubscription'
import { mergeLive, mergeSnapshot } from '../../utils/telemetrySeries'
import { simulationError, simulationService } from '../../services/simulationService'
import type { SimulationList } from '../../types/simulation'
import { SimulationLiveCard } from './SimulationLiveCard'
import SimulationProfileEditor from './SimulationProfileEditor'
import SimulationAutomationControl from './SimulationAutomationControl'

export default function SimulationPage() {
    const { selectedHallId } = useFactory()
    const { user } = useAuth()
    const [params, setParams] = useSearchParams()
    const [data, setData] = useState<SimulationList | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('All')
    const [view, setView] = useState<'overview' | 'profile'>('overview')
    const scope = useRef(selectedHallId)
    scope.current = selectedHallId
    const refresh = useCallback(async () => {
        try {
            const result = await simulationService.list(selectedHallId)
            if (scope.current === selectedHallId) {
                setData(current => {
                    const previous = new Map(current?.machines.map(machine => [machine.machineId, machine]))
                    return {
                        ...result,
                        machines: result.machines.map(machine =>
                            mergeSnapshot(previous.get(machine.machineId), machine),
                        ),
                    }
                })
                setError(null)
            }
        } catch (e) {
            if (scope.current === selectedHallId) {
                setError(simulationError(e))
            }
        }
    }, [selectedHallId])
    useEffect(() => {
        setData(null)
        void refresh()
        const timer = setInterval(() => void refresh(), 5000)
        return () => {
            clearInterval(timer)
        }
    }, [refresh])
    const hallIds = [...new Set(data?.machines.map(m => m.factoryHallId) ?? [])]
    const connectionStatus = useTelemetrySubscription(
        state =>
            setData(current =>
                current ? { ...current, machines: current.machines.map(m => mergeLive(m, state)) } : current,
            ),
        { hallIds, onReconnect: () => void refresh() },
    )
    const machines = data?.machines ?? []
    const filtered = machines.filter(
        m =>
            m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
            (filter === 'All' || (filter === 'Requested' ? m.simulationEnabled : m.workerStatus === filter)),
    )
    const selectedId = params.get('machineId')
    const selected = filtered.find(m => m.machineId === selectedId) ?? filtered[0]
    const admin = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin'
    const stats = data
        ? [
              {
                  label: 'Redis connection',
                  value: data.redisAvailable ? 'Connected' : 'Unavailable',
                  icon: Database,
                  tone: data.redisAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
              },
              {
                  label: 'Active simulations',
                  value: `${machines.filter(m => m.workerStatus === 'Running').length} / ${machines.length}`,
                  icon: Cpu,
                  tone: 'bg-violet-50 text-violet-500',
              },
              {
                  label: 'Queued samples',
                  value: String(data.historyQueueLength),
                  icon: Layers,
                  tone: 'bg-blue-50 text-blue-500',
              },
              {
                  label: 'Dropped samples',
                  value: String(data.droppedHistorySamples),
                  icon: TriangleAlert,
                  tone: 'bg-amber-50 text-amber-500',
              },
          ]
        : []
    return (
        <div className="flex h-full flex-col overflow-hidden bg-slate-50">
            <Header
                leftContent={
                    <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-violet-50 p-2">
                            <FlaskConical className="h-4 w-4 text-violet-600" />
                        </span>
                        <h1 className="text-base font-bold text-slate-800">Machine Simulation</h1>
                    </div>
                }
            />
            <main className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
                <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-linear-to-r from-slate-900 to-indigo-950 px-6 py-6 text-white">
                    <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">
                            Simulation workspace
                        </p>
                        <h2 className="text-xl font-bold">Test machine behaviour</h2>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400">
                            Choose a machine, trigger a scenario, and tune its profile.
                        </p>
                    </div>
                    <button
                        onClick={() => void refresh()}
                        className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold transition hover:bg-white/10"
                    >
                        <RefreshCw className="h-3.5 w-3.5 text-violet-300" />
                        Refresh data
                    </button>
                </section>
                {error && (
                    <p
                        role="alert"
                        className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                    >
                        {error}
                    </p>
                )}
                {data && (
                    <>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            {stats.map(({ label, value, icon: Icon, tone }) => (
                                <div
                                    key={label}
                                    className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <span className={`rounded-xl p-3 ${tone}`}>
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                                        <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
                                            {value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {(data.serviceError || data.lastHistoryError) && (
                            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                                {data.serviceError}{' '}
                                {data.lastHistoryError && `History persistence: ${data.lastHistoryError}`}
                            </p>
                        )}
                        {data.automation && (
                            <SimulationAutomationControl
                                automation={data.automation}
                                onChange={() => void refresh()}
                            />
                        )}
                        <div className="grid items-start gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
                            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-0">
                                <div className="space-y-3 border-b border-slate-100 p-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-bold text-slate-800">Machines</h2>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                            {filtered.length}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                                        <input
                                            aria-label="Search machines"
                                            placeholder="Search machines…"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-violet-400"
                                        />
                                    </div>
                                    <select
                                        aria-label="Simulation filter"
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                                    >
                                        <option value="All">All simulations</option>
                                        <option value="Running">Running</option>
                                        <option value="Stopped">Stopped</option>
                                        <option value="Faulted">Worker fault</option>
                                        <option value="Requested">Simulation requested</option>
                                    </select>
                                </div>
                                <div className="max-h-[280px] overflow-y-auto xl:max-h-[540px]">
                                    {filtered.map(m => (
                                        <button
                                            key={m.machineId}
                                            onClick={() => setParams({ machineId: m.machineId })}
                                            aria-pressed={selected?.machineId === m.machineId}
                                            className={`block w-full border-b border-slate-100 p-4 text-left transition last:border-0 ${selected?.machineId === m.machineId ? 'border-l-[3px] border-l-violet-500 bg-violet-50/70' : 'border-l-[3px] border-l-transparent hover:bg-slate-50'}`}
                                        >
                                            <div className="text-xs font-semibold leading-relaxed text-slate-800">
                                                {m.name}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                                                <span
                                                    className={`flex items-center gap-1.5 ${m.machineStatus === 'Error' ? 'text-rose-600' : m.machineStatus === 'Running' ? 'text-emerald-600' : 'text-slate-400'}`}
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {m.machineStatus}
                                                </span>
                                                <span className="text-slate-400">
                                                    {m.profile?.preset ?? 'No profile'}
                                                </span>
                                            </div>
                                            {m.automationEnabled && m.automaticRepairAtUtc && (
                                                <p className="mt-2 text-[10px] font-medium text-blue-500">
                                                    Repair at{' '}
                                                    {new Date(m.automaticRepairAtUtc).toLocaleTimeString('en-GB')}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                    {!filtered.length && (
                                        <p className="p-6 text-xs text-slate-500">
                                            No machines match these filters.
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">
                                    <Activity
                                        className={`h-3 w-3 ${connectionStatus === 'Live' ? 'text-emerald-500' : 'text-amber-500'}`}
                                    />
                                    {connectionStatus} updates
                                </div>
                            </aside>
                            {selected && (
                                <div key={selected.machineId} className="min-w-0 space-y-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                                                Selected machine
                                            </p>
                                            <h2 className="text-lg font-bold text-slate-800">{selected.name}</h2>
                                        </div>
                                        <Link
                                            to={`/machines/${selected.machineId}`}
                                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-violet-600"
                                        >
                                            Machine details
                                            <ArrowUpRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                    {admin && (
                                        <div
                                            className="flex gap-4 border-b border-slate-200"
                                            aria-label="Workspace view"
                                        >
                                            {(['overview', 'profile'] as const).map(item => (
                                                <button
                                                    key={item}
                                                    aria-pressed={view === item}
                                                    onClick={() => setView(item)}
                                                    className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-xs font-semibold transition ${view === item ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {item === 'overview' ? (
                                                        <Waves className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                                    )}
                                                    {item === 'overview' ? 'Live overview' : 'Simulation profile'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div hidden={admin && view !== 'overview'}>
                                        <SimulationLiveCard
                                            machine={selected}
                                            connectionStatus={connectionStatus}
                                            onChange={() => void refresh()}
                                        />
                                    </div>
                                    {admin && (
                                        <div hidden={view !== 'profile'}>
                                            <SimulationProfileEditor
                                                machineId={selected.machineId}
                                                serverVersion={selected.profile?.version}
                                                onChange={() => void refresh()}
                                            />
                                        </div>
                                    )}
                                    {!admin && (
                                        <p className="text-xs text-slate-400">
                                            Read access · Hall administrators manage controls and profiles.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {!data && !error && <p className="text-sm text-slate-500">Loading simulations…</p>}
            </main>
        </div>
    )
}
