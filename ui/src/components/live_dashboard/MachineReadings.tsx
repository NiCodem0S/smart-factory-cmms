import { useState } from 'react'
import { ArrowRight, CheckCircle2, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardMachine } from '../../types/dashboard'
import type { MachineStatus } from '../../types/machine'

const priority: Record<MachineStatus, number> = { Error: 0, Warning: 1, Maintenance: 2, Running: 3, Offline: 4 }
const readTime = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

export default function MachineReadings({ machines }: { machines: DashboardMachine[] }) {
    const [attentionOnly, setAttentionOnly] = useState(false)
    const [showAll, setShowAll] = useState(false)
    const filtered = machines
        .filter(machine => !attentionOnly || machine.status === 'Error' || machine.status === 'Warning')
        .sort((a, b) => priority[a.status] - priority[b.status] || a.name.localeCompare(b.name))
    const visible = showAll ? filtered : filtered.slice(0, 6)

    function changeFilter(needsAttention: boolean) {
        setAttentionOnly(needsAttention)
        setShowAll(false)
    }

    return (
        <section className="dash-panel machine-readings">
            <div className="dash-panel-heading">
                <h2>Machine readings</h2>
                <div className="dash-toggle" role="group" aria-label="Filter machine readings">
                    <button aria-pressed={!attentionOnly} onClick={() => changeFilter(false)}>All</button>
                    <button aria-pressed={attentionOnly} onClick={() => changeFilter(true)}>Needs attention</button>
                </div>
            </div>
            {filtered.length > 0 ? (
                <div className="readings-scroll" role="region" aria-label="Latest machine readings" tabIndex={0}>
                    <table className="readings-table">
                        <thead><tr><th>Machine</th><th>State</th><th>Temp.</th><th>Vibration</th></tr></thead>
                        <tbody>
                            {visible.map(machine => {
                                const reading = machine.latestTelemetry
                                return (
                                    <tr key={machine.id}>
                                        <td>
                                            <Link className="reading-machine" to={`/machines/${machine.id}`}>
                                                <strong>{machine.name}</strong>
                                                <small>
                                                    {reading ? <time dateTime={reading.timestampUtc}>Read {readTime.format(new Date(reading.timestampUtc))}</time> : 'No reading yet'}
                                                </small>
                                            </Link>
                                        </td>
                                        <td><span className="reading-state" data-state={machine.status}><i />{machine.status}</span></td>
                                        <td>{reading?.temperature == null ? '—' : `${reading.temperature.toFixed(1)} °C`}</td>
                                        <td>{reading?.vibration == null ? '—' : `${reading.vibration.toFixed(2)} mm/s`}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="dash-empty">
                    {attentionOnly ? <CheckCircle2 /> : <Cpu />}
                    <strong>{attentionOnly ? 'No machines in warning or error' : 'No machines in this selection'}</strong>
                </div>
            )}
            <div className="dash-panel-footer">
                {filtered.length > 6 ? (
                    <button className="readings-expand" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                        {showAll ? 'Show fewer machines' : `Show all ${filtered.length} machines`}
                    </button>
                ) : <span>{filtered.length} {filtered.length === 1 ? 'machine' : 'machines'}</span>}
                <Link to="/machines">Machine fleet <ArrowRight size={14} /></Link>
            </div>
        </section>
    )
}
