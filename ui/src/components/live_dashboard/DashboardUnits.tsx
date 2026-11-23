import { useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardMachine } from '../../types/dashboard'

const priority = { Error: 0, Warning: 1, Running: 2, Maintenance: 3, Offline: 4 }
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function DashboardUnits({ machines }: { machines: DashboardMachine[] }) {
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState(false)
    const query = search.trim().toLowerCase()
    const matches = machines.filter(machine => [machine.name, machine.serialNumber ?? '']
        .some(value => value.toLowerCase().includes(query)))
        .sort((a, b) => priority[a.status] - priority[b.status] || a.name.localeCompare(b.name))
    const visible = expanded || query ? matches : matches.slice(0, 6)

    return (
        <section className="fd-units" aria-label="Monitored units">
            <div className="fd-units-heading"><h2>Monitored Units <small>{matches.length}</small></h2>
                <label className="fd-search"><Search size={15} /><input type="search" placeholder="Search ID or name…"
                    aria-label="Search machines by ID or name" value={search} onChange={event => setSearch(event.target.value)} /></label>
            </div>
            <div className="fd-unit-grid">{visible.map(machine => {
                const telemetry = machine.latestTelemetry
                return (
                    <article className="fd-unit" data-status={machine.status} key={machine.id}>
                        <div className="fd-unit-top">
                            <div><h3><Link to={`/machines/${machine.id}`}>{machine.name}<ArrowUpRight size={13} /></Link></h3>
                                <span className="fd-unit-status"><i />{machine.status}</span></div>
                        </div>
                        <dl className="fd-unit-metrics">
                            <div><dt>Temperature</dt><dd>{telemetry?.temperature == null ? '—' : <>{telemetry.temperature.toFixed(1)}<small> °C</small></>}</dd></div>
                            <div><dt>Vibration</dt><dd>{telemetry?.vibration == null ? '—' : <>{telemetry.vibration.toFixed(2)}<small> mm/s</small></>}</dd></div>
                        </dl>
                        <dl className="fd-unit-details"><div><dt>Category</dt><dd>{machine.category}</dd></div>
                            <div><dt>Production line</dt><dd>{machine.productionLineName ?? 'Independent station'}</dd></div>
                        </dl>
                        <div className="fd-unit-read">{telemetry ? <time dateTime={telemetry.timestampUtc}>Last read {date.format(new Date(telemetry.timestampUtc))}</time> : 'No telemetry received yet'}</div>
                    </article>
                )
            })}</div>
            {matches.length === 0 && <p className="fd-empty">{machines.length ? 'No machines match your search.' : 'No machines in this selection.'}</p>}
            {!query && matches.length > 6 && <button className="fd-show-more" aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer machines' : `Show all ${matches.length} machines`}</button>}
        </section>
    )
}
