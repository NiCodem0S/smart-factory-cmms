import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Boxes, Radio, RefreshCw, TriangleAlert, Zap } from 'lucide-react'
import Header from '../layout/Header'
import { useFactory } from '../../context/FactoryContext'
import { useLiveDashboard } from '../../hooks/useLiveDashboard'
import { telemetryTimestamp } from '../../utils/telemetrySeries'
import type { DashboardMachine, DashboardSnapshot } from '../../types/dashboard'
import { machineStatuses } from '../../types/machine'
import DashboardUnits from './DashboardUnits'
import DashboardEvents from './DashboardEvents'
import './factory-dashboard.css'

const format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const freshnessMs = 60_000

function freshCount(machines: DashboardMachine[], now: number) {
    const checkedAt = Math.max(now, Date.now())
    return machines.filter(machine => {
        const reading = machine.latestTelemetry
        if (!reading) return false
        const age = checkedAt - telemetryTimestamp(reading.timestampUtc)
        const hasMetric = [reading.temperature, reading.vibration, reading.powerLoadKw, reading.networkLatencyMs]
            .some(value => value !== null && Number.isFinite(value))
        return age >= 0 && age <= freshnessMs && hasMetric
    }).length
}

function Coverage({ machines, now }: { machines: DashboardMachine[]; now: number }) {
    const reporting = freshCount(machines, now)

    return (
        <section className="fd-card fd-coverage">
            <div className="fd-kpi-heading"><h2>Reporting machines</h2><Radio size={18} aria-hidden="true" /></div>
            <p className="fd-kpi-value">{reporting}<span className="fd-coverage-divider">/</span>{machines.length}</p>
            <small>Readings within the last 60 seconds</small>
        </section>
    )
}

function FleetStatus({ data, now }: { data: DashboardSnapshot; now: number }) {
    const { summary, machines } = data
    const counts = {
        Running: summary.runningMachines, Warning: summary.warningMachines, Error: summary.errorMachines,
        Maintenance: summary.maintenanceMachines, Offline: summary.offlineMachines,
    }
    let end = 0
    const slices = machineStatuses.filter(state => counts[state]).map(state => {
        const start = end
        end += counts[state] / summary.totalMachines * 100
        return `var(--fd-${state}) ${start}% ${end}%`
    })
    const percentage = (count: number) => summary.totalMachines ? Math.round(count / summary.totalMachines * 100) : 0
    const reporting = freshCount(machines, now)
    const indicators = [
        { label: 'Running machines', value: percentage(counts.Running), color: '#3b82f6' },
        { label: 'Fresh telemetry', value: percentage(reporting), color: '#3b82f6' },
        { label: 'Assigned to a line', value: percentage(machines.filter(machine => machine.productionLineId).length), color: '#22c55e' },
    ]

    return (
        <section className="fd-card fd-fleet">
            <h2>Fleet status</h2><p className="fd-subtitle">Live distribution of monitored machines</p>
            <div className="fd-fleet-body">
                <div className="fd-distribution">
                    <div className="fd-donut" role="img" aria-label={`${counts.Running} of ${summary.totalMachines} machines running`}
                        style={{ background: slices.length ? `conic-gradient(${slices.join(',')})` : '#e2e8f0' }}>
                        <div><strong>{summary.totalMachines ? percentage(counts.Running) + '%' : '—'}</strong><span>Running</span></div>
                    </div>
                    <ul className="fd-legend">{machineStatuses.map(state => <li key={state}>
                        <i style={{ background: `var(--fd-${state})` }} /><b>{counts[state]}</b><span>{state}</span>
                    </li>)}</ul>
                </div>
                <div className="fd-indicators">{indicators.map(indicator => <div key={indicator.label}>
                    <div><span>{indicator.label}</span><b>{indicator.value}%</b></div>
                    <progress max="100" value={indicator.value} style={{ accentColor: indicator.color }} aria-label={indicator.label} />
                </div>)}</div>
            </div>
        </section>
    )
}

export default function FactoryDashboard() {
    const { data, loading, refreshing, error, refresh, connectionStatus } = useLiveDashboard()
    const { halls, selectedHallId } = useFactory()
    const hall = halls.find(item => item.id === selectedHallId)
    const scopeKey = data?.factoryHallId ?? 'global'
    const [now, setNow] = useState(Date.now)

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="factory-dashboard">
            <div className="fd-main">
                <Header leftContent={<div className="fd-page-title"><h1>Live Dashboard</h1>
                    <p>{hall?.name ?? 'All factory halls'}</p></div>}
                    rightContent={<button className="fd-refresh" onClick={() => void refresh()} disabled={loading || refreshing}
                        aria-label="Refresh dashboard" title="Refresh dashboard"><RefreshCw size={16} /></button>} />
                <div className="fd-content">
                    <div className="fd-connection-row">
                        <span data-live={connectionStatus === 'Live'}><i />{connectionStatus === 'Live' ? 'SignalR Live' : connectionStatus}</span>
                        {data && <time dateTime={data.generatedAtUtc}>Snapshot {new Date(data.generatedAtUtc).toLocaleTimeString('en-GB')}</time>}
                    </div>
                    {error && <div className="fd-error" role="alert"><TriangleAlert size={18} />
                        <span>{error.includes('timeout') ? 'Dashboard refresh timed out.' : error} {data && 'Showing the latest available data.'}</span>
                        <button onClick={() => void refresh()} disabled={refreshing}>Retry</button></div>}
                    {!data && loading && <p className="fd-loading" role="status"><Activity size={20} />Loading factory data…</p>}
                    {data && <>
                        <div className="fd-overview">
                            <FleetStatus data={data} now={now} />
                            <section className="fd-card fd-critical">
                                <TriangleAlert className="fd-alert-watermark" aria-hidden="true" />
                                <h2>Critical alerts</h2><p className="fd-kpi-value">{data.summary.activeCriticalIncidents}</p>
                                <small>{data.summary.activeCriticalIncidents ? 'Active incidents requiring attention' : 'No active critical incidents'}</small>
                            </section>
                            <Coverage key={scopeKey} machines={data.machines} now={now} />
                            <section className="fd-card fd-power">
                                <div className="fd-kpi-heading"><h2>Power load</h2><Zap size={16} /></div>
                                <p className="fd-kpi-value">{data.summary.powerLoadKw === null ? '—' : format.format(data.summary.powerLoadKw)} <small>kW</small></p>
                                <small>{data.summary.machinesWithPowerReadings} machines reporting power</small>
                            </section>
                            <section className="fd-card fd-produced">
                                <div className="fd-kpi-heading"><h2>Produced</h2><Boxes size={16} /></div>
                                <p className="fd-kpi-value">{format.format(data.summary.totalProduced)}</p>
                                <small>Sum of machine production counters</small>
                            </section>
                        </div>
                        <section className="fd-card fd-heatmap">
                            <h2>Live plant heatmap</h2><p className="fd-subtitle">Real-time status of individual machines</p>
                            <div className="fd-heatmap-tiles">{data.machines.map(machine => <Link key={machine.id}
                                className="fd-heatmap-tile" to={`/machines/${machine.id}`} data-status={machine.status}
                                title={`${machine.name} · ${machine.status}`} aria-label={`${machine.name}, ${machine.status}`}>
                                <span>{machine.status === 'Running' ? '✓' : machine.status === 'Warning' ? '!' : machine.status === 'Error' ? '×' : machine.status === 'Maintenance' ? '◇' : '−'}</span>
                            </Link>)}</div>
                        </section>
                        <DashboardUnits key={scopeKey} machines={data.machines} />
                    </>}
                </div>
            </div>
            <DashboardEvents key={scopeKey} incidents={data?.incidents ?? []} loading={loading}
                connectionStatus={connectionStatus} />
        </div>
    )
}
