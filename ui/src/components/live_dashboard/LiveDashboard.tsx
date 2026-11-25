import { Activity, Boxes, CircleAlert, LayoutDashboard, Radio, RefreshCw, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Header from '../layout/Header'
import { useLiveDashboard } from '../../hooks/useLiveDashboard'
import FloorMonitor from './FloorMonitor'
import MachineReadings from './MachineReadings'
import IncidentFeed from './IncidentFeed'
import './dashboard.css'

const wholeNumber = new Intl.NumberFormat('en-GB')
const power = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const snapshotTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Metric({ icon: Icon, label, value, unit, detail, tone }: {
    icon: LucideIcon; label: string; value: string; unit?: string; detail: string; tone: string
}) {
    return (
        <div className={`dash-metric ${tone}`}>
            <span className="metric-icon"><Icon size={20} strokeWidth={1.8} /></span>
            <div><h2>{label}</h2><p>{value} {unit && <small>{unit}</small>}</p><span>{detail}</span></div>
        </div>
    )
}

export default function LiveDashboard() {
    const { data, loading, refreshing, error, refresh, connectionStatus } = useLiveDashboard()
    const summary = data?.summary

    return (
        <div className="dashboard">
            <Header leftContent={<span className="dashboard-location"><LayoutDashboard size={17} /> Dashboard</span>} />
            <div className="dash-content">
                <div className="dash-title-row">
                    <div>
                        <h1>Operations overview</h1>
                        {data && <p>Last snapshot <time dateTime={data.generatedAtUtc}>{snapshotTime.format(new Date(data.generatedAtUtc))}</time></p>}
                    </div>
                    <div className="dash-actions">
                        {data && <span className="dash-connection" data-live={connectionStatus === 'Live'}>
                            <Radio size={15} />{connectionStatus === 'Live' ? 'Live connection' : connectionStatus}
                        </span>}
                        <button onClick={() => void refresh()} disabled={loading || refreshing} className="dash-refresh" aria-label="Refresh dashboard" title="Refresh dashboard">
                            <RefreshCw size={16} className={loading || refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
                {error && <div className="dashboard-error" role="alert"><CircleAlert size={20} />
                    <span>{error}{data && ' Showing the last available snapshot.'}</span>
                    <button onClick={() => void refresh()} disabled={loading || refreshing}>Retry</button>
                </div>}
                {!data && loading && <div className="dashboard-loading" role="status"><Activity size={22} /> Loading the production floor…</div>}
                {data && summary && (
                    <>
                        <FloorMonitor key={data.factoryHallId ?? 'global'} machines={data.machines} summary={summary} />
                        <section className="dash-metrics" aria-label="Operating indicators">
                            <Metric icon={Zap} tone="power-metric" label="Measured power"
                                value={summary.powerLoadKw === null ? '—' : power.format(summary.powerLoadKw)} unit="kW"
                                detail={`${summary.machinesWithPowerReadings} of ${summary.totalMachines} machines reporting in the last minute`} />
                            <Metric icon={Boxes} tone="parts-metric" label="Parts counted"
                                value={wholeNumber.format(summary.totalProduced)} detail="Sum of machine production counters" />
                            <Metric icon={CircleAlert} tone={summary.activeCriticalIncidents ? 'critical-metric' : 'clear-metric'}
                                label="Active critical incidents" value={wholeNumber.format(summary.activeCriticalIncidents)}
                                detail={data.hallIds.length === 1 ? 'In the selected factory hall' : `Across ${data.hallIds.length} factory halls`} />
                        </section>
                        <div className="dash-detail-grid">
                            <MachineReadings key={data.factoryHallId ?? 'global'} machines={data.machines} />
                            <IncidentFeed key={data.factoryHallId ?? 'global'} incidents={data.incidents} />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
