import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardIncident } from '../../types/dashboard'

const eventTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function DashboardEvents({ incidents, loading, connectionStatus }: {
    incidents: DashboardIncident[]; loading: boolean; connectionStatus: string
}) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? incidents : incidents.slice(0, 5)

    return (
        <aside className="fd-events" aria-label="Event stream">
            <header><h2>Event stream</h2><p data-live={connectionStatus === 'Live'}><i />
                {connectionStatus === 'Live' ? 'Connected to live telemetry' : connectionStatus}</p></header>
            <div className="fd-events-list">
                {visible.map(incident => (
                    <article className="fd-event" data-severity={incident.severity} data-resolved={incident.status !== 'Active'} key={incident.id}>
                        <div className="fd-event-meta"><b>{incident.severity}</b><time dateTime={incident.triggeredAtUtc}>{eventTime.format(new Date(incident.triggeredAtUtc))}</time></div>
                        <h3>{incident.machineName}</h3>
                        <p>{incident.message.startsWith(`Simulation: ${incident.machineName}: `)
                            ? incident.message.slice(`Simulation: ${incident.machineName}: `.length)
                            : incident.message}</p>
                        <div className="fd-event-footer"><span>{incident.status}</span><Link to={`/machines/${incident.machineId}`}>View machine <ArrowUpRight size={12} /></Link></div>
                    </article>
                ))}
                {!visible.length && <p className="fd-empty">{loading ? 'Loading events…' : 'No incidents recorded for this selection.'}</p>}
                {incidents.length > 5 && <button className="fd-show-more" aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer events' : `Show all ${incidents.length} recent events`}</button>}
            </div>
        </aside>
    )
}
