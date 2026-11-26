import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { Loader2, Wrench, X } from 'lucide-react'
import { createMaintenanceWorkOrder, fetchMaintenanceMachines } from '../../services/maintenanceService'
import { simulationError, simulationService } from '../../services/simulationService'
import type {
    MaintenanceAssignee,
    MaintenanceMachineOption,
    MaintenanceWorkOrder,
    WorkOrderType,
} from '../../types/maintenance'
import { shortHallPillName } from '../live_dashboard/operations/operationsHelpers'

interface CreateWorkOrderModalProps {
    isOpen: boolean
    factoryHallId: string | null
    assignees: MaintenanceAssignee[]
    canManageMachines: boolean
    defaultMachineId?: string | null
    onClose: () => void
    onCreated: (created: MaintenanceWorkOrder) => void
}

const TYPE_OPTIONS: { value: WorkOrderType; label: string; hint: string }[] = [
    { value: 'Routine', label: 'Routine', hint: 'Scheduled inspection or PM' },
    { value: 'Predictive', label: 'Predictive', hint: 'Anomaly or wear warning' },
    { value: 'Critical', label: 'Critical', hint: 'Urgent breakdown repair' },
]

function defaultDueDateInput(): string {
    const d = new Date(Date.now() + 3 * 86_400_000)
    return d.toISOString().slice(0, 10)
}

export default function CreateWorkOrderModal({
    isOpen,
    factoryHallId,
    assignees,
    canManageMachines,
    defaultMachineId = null,
    onClose,
    onCreated,
}: CreateWorkOrderModalProps) {
    const [machines, setMachines] = useState<MaintenanceMachineOption[]>([])
    const [loadingMachines, setLoadingMachines] = useState(false)

    const [machineId, setMachineId] = useState('')
    const [title, setTitle] = useState('')
    const [type, setType] = useState<WorkOrderType>('Routine')
    const [assignedUserId, setAssignedUserId] = useState('')
    const [dueDate, setDueDate] = useState(defaultDueDateInput)
    const [description, setDescription] = useState('')
    const [putInMaintenance, setPutInMaintenance] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        setError(null)
        setTitle('')
        setDescription('')
        setDueDate(defaultDueDateInput())
        setPutInMaintenance(false)
        setMachineId(defaultMachineId ?? '')
        setType(defaultMachineId ? 'Critical' : 'Routine')
        setAssignedUserId(assignees[0]?.userId ?? '')

        const controller = new AbortController()
        setLoadingMachines(true)
        void fetchMaintenanceMachines(factoryHallId, controller.signal)
            .then(list => {
                if (controller.signal.aborted) return
                setMachines(list)
                if (!defaultMachineId && list.length > 0) {
                    setMachineId(prev => prev || list[0].id)
                }
            })
            .catch(err => {
                if (!controller.signal.aborted) setError(simulationError(err))
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingMachines(false)
            })

        return () => controller.abort()
    }, [isOpen, factoryHallId, defaultMachineId])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const selectedMachine = machines.find(m => m.id === machineId) ?? null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!machineId || !title.trim()) {
            setError('Select a machine and enter a work order title.')
            return
        }

        setSaving(true)
        setError(null)
        try {
            const created = await createMaintenanceWorkOrder({
                machineId,
                title: title.trim(),
                description: description.trim() || null,
                type,
                assignedUserId: assignedUserId || null,
                dueDateUtc: dueDate ? new Date(`${dueDate}T18:00:00Z`).toISOString() : null,
            })

            if (putInMaintenance && canManageMachines && selectedMachine?.status !== 'Maintenance') {
                try {
                    await simulationService.action(machineId, 'maintenance', true)
                } catch {
                    // Work order was created cleanly; ignore if machine cannot transition right now
                }
            }

            onCreated(created)
            onClose()
        } catch (err) {
            setError(simulationError(err))
        } finally {
            setSaving(false)
        }
    }

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Wrench className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">New Work Order</h2>
                            <p className="text-xs text-slate-500">Schedule service or dispatch a technician</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {/* Asset */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Machine</label>
                        <select
                            value={machineId}
                            onChange={e => setMachineId(e.target.value)}
                            disabled={loadingMachines}
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {loadingMachines ? (
                                <option value="">Loading machines…</option>
                            ) : (
                                <>
                                    <option value="">-- Select machine --</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.status} · {shortHallPillName(m.factoryHallName)})
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Inspect spindle bearings & replace coolant filter"
                            maxLength={200}
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Type selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority / Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {TYPE_OPTIONS.map(opt => {
                                const selected = type === opt.value
                                const tone =
                                    opt.value === 'Critical'
                                        ? selected
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        : opt.value === 'Predictive'
                                          ? selected
                                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                          : selected
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setType(opt.value)}
                                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${tone}`}
                                    >
                                        <div className="text-xs font-bold">{opt.label}</div>
                                        <div className="text-[10.5px] opacity-75 mt-0.5 leading-snug">{opt.hint}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Assignee & Due Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Assignee</label>
                            <select
                                value={assignedUserId}
                                onChange={e => setAssignedUserId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Unassigned</option>
                                {assignees.map(a => (
                                    <option key={a.userId} value={a.userId}>
                                        {a.fullName} ({a.activeWorkOrdersCount} active)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Scope / Notes <span className="font-normal text-slate-400">(Optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Checklist, replacement parts, or diagnostic context…"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {canManageMachines && selectedMachine && selectedMachine.status !== 'Maintenance' && (
                        <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={putInMaintenance}
                                onChange={e => setPutInMaintenance(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                                Place <strong>{selectedMachine.name}</strong> into Maintenance mode immediately
                            </span>
                        </label>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || loadingMachines}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{saving ? 'Creating…' : 'Create Work Order'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    )
}
