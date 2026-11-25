import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DashboardIncident } from '../../types/dashboard'

const timestamp = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function IncidentFeed({ incidents }: { incidents: DashboardIncident[] }) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? incidents : incidents.slice(0, 4)

    return (
        <section className="dash-panel incident-feed">
            <div className="dash-panel-heading">
                <h2>Recent incidents</h2><History size={18} aria-hidden="true" />
            </div>
            {visible.length > 0 ? (
                <ol className="incident-list">
                    {visible.map(incident => (
                        <li key={incident.id} data-severity={incident.severity}>
                            <div className="incident-marker" />
                            <div className="incident-meta">
                                <strong>{incident.severity}</strong><span>{incident.status}</span>
                                <time dateTime={incident.triggeredAtUtc}>{timestamp.format(new Date(incident.triggeredAtUtc))}</time>
                            </div>
                            <p>{incident.message}</p>
                            <Link to={`/machines/${incident.machineId}`}>{incident.machineName} <ArrowUpRight size={12} /></Link>
                        </li>
                    ))}
                </ol>
            ) : <div className="dash-empty"><CheckCircle2 /><strong>No incidents recorded</strong></div>}
            {incidents.length > 4 && (
                <button className="dash-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Show fewer incidents' : `Show all ${incidents.length} recent incidents`}
                </button>
            )}
        </section>
    )
}
