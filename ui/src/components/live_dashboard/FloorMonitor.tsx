import { useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, CircleX, Factory, Power, TriangleAlert, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { machineStatuses } from '../../types/machine'
import type { DashboardMachine, DashboardSummary } from '../../types/dashboard'

const stateIcons = { Running: Check, Warning: TriangleAlert, Error: CircleX, Maintenance: Wrench, Offline: Power }
const previewLineCount = 3

function groupStations(machines: DashboardMachine[]) {
    const lines = new Map<string, { name: string; hall: string; independent: boolean; stations: DashboardMachine[] }>()

    for (const machine of machines) {
        const key = machine.productionLineId ?? machine.factoryHallId
        const line = lines.get(key) ?? {
            name: machine.productionLineName ?? 'Independent stations',
            hall: machine.factoryHallName,
            independent: machine.productionLineId === null,
            stations: [],
        }
        line.stations.push(machine)
        lines.set(key, line)
    }

    for (const line of lines.values()) {
        line.stations.sort((a, b) => a.orderInLine - b.orderInLine || a.name.localeCompare(b.name))
    }

    return [...lines.entries()].sort(([, a], [, b]) =>
        Number(a.independent) - Number(b.independent) || a.hall.localeCompare(b.hall) || a.name.localeCompare(b.name))
}

export default function FloorMonitor({ machines, summary }: { machines: DashboardMachine[]; summary: DashboardSummary }) {
    const [expanded, setExpanded] = useState(false)
    const lines = groupStations(machines)
    const counts = {
        Running: summary.runningMachines, Warning: summary.warningMachines, Error: summary.errorMachines,
        Maintenance: summary.maintenanceMachines, Offline: summary.offlineMachines,
    }

    return (
        <section className="floor-monitor" aria-label="Production floor">
            <div className="floor-condition">
                <h2><Factory size={17} /> Production floor</h2>
                <div className="floor-total">
                    {counts.Running}<span> / {summary.totalMachines}</span>
                </div>
                <p className="floor-caption">Machines in running state</p>
                <div className="condition-bar" aria-hidden="true">
                    {machineStatuses.filter(status => counts[status] > 0).map(status =>
                        <span key={status} data-state={status} style={{ flexGrow: counts[status] }} />)}
                </div>
                <ul className="condition-legend">
                    {machineStatuses.map(status => (
                        <li key={status} data-state={status}>
                            <i />{status}<b>{counts[status]}</b>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="station-map">
                <div className="station-heading">
                    <h3>Stations by line</h3>
                    <Link to="/production">Production lines <ArrowUpRight size={14} /></Link>
                </div>
                {lines.length === 0 && <p className="no-stations">No machines in this selection.</p>}
                <div className="station-lines">
                    {(expanded ? lines : lines.slice(0, previewLineCount)).map(([id, line]) => (
                        <div key={id} className="station-line">
                            <div className="station-line-name"><strong>{line.name}</strong><small>{line.hall}</small></div>
                            <div className="station-cells">
                                {line.stations.map(machine => {
                                    const StateIcon = stateIcons[machine.status]
                                    const stationCode = machine.serialNumber?.replace(/^(\w+)-\d{4}$/, '$1') || machine.name
                                    return (
                                        <Link key={machine.id} to={`/machines/${machine.id}`}
                                            data-state={machine.status} className="station-cell"
                                            title={[machine.name, machine.serialNumber, machine.status].filter(Boolean).join(' · ')}
                                            aria-label={`${machine.name}, ${machine.status}`}>
                                            <StateIcon size={12} aria-hidden="true" /><span>{stationCode}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {lines.length > previewLineCount && (
                    <button className="more-lines" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
                        {expanded ? 'Show fewer groups' : `Show all ${lines.length} groups`} <ChevronDown size={14} />
                    </button>
                )}
            </div>
        </section>
    )
}
