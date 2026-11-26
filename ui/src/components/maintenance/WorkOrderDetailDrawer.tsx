import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowUpRight,
    Calendar,
    CheckCircle2,
    Clock,
    Cpu,
    Play,
    RotateCcw,
    Trash2,
    User,
    Wrench,
    X,
} from 'lucide-react'
import type {
    MaintenanceAssignee,
    MaintenanceWorkOrder,
    PatchMaintenanceWorkOrderPayload,
    WorkOrderStatus,
} from '../../types/maintenance'
import { telemetryTimestamp } from '../../utils/telemetrySeries'
import { shortHallPillName, statusColorToken } from '../live_dashboard/operations/operationsHelpers'

interface WorkOrderDetailDrawerProps {
    workOrder: MaintenanceWorkOrder | null
    assignees: MaintenanceAssignee[]
    canManageMachines: boolean
    busyAction: string | null
    onClose: () => void
    onPatch: (workOrder: MaintenanceWorkOrder, patch: PatchMaintenanceWorkOrderPayload, feedback: string) => void
    onDelete: (workOrder: MaintenanceWorkOrder) => void
}

const STATUS_STEPS: { value: WorkOrderStatus; label: string }[] = [
    { value: 'Open', label: 'Open' },
    { value: 'InProgress', label: 'In Progress' },
    { value: 'Review', label: 'Review' },
    { value: 'Resolved', label: 'Resolved' },
]

function formatExactDate(iso: string | null): string {
    if (!iso) return '—'
    const ts = telemetryTimestamp(iso)
    if (!Number.isFinite(ts)) return '—'
    return new Date(ts).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function WorkOrderDetailDrawer({
    workOrder,
    assignees,
    canManageMachines,
    busyAction,
    onClose,
    onPatch,
    onDelete,
}: WorkOrderDetailDrawerProps) {
    const [editingNotes, setEditingNotes] = useState(false)
    const [notesDraft, setNotesDraft] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(false)

    useEffect(() => {
        setEditingNotes(false)
        setConfirmDelete(false)
        setNotesDraft(workOrder?.description ?? '')
    }, [workOrder?.id, workOrder?.description])

    useEffect(() => {
        if (!workOrder) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [workOrder, onClose])

    if (!workOrder) return null

    const isBusy = busyAction !== null
    const typeTone =
        workOrder.type === 'Critical'
            ? { fg: 'var(--sf-error)', bg: 'var(--sf-error-bg)' }
            : workOrder.type === 'Predictive'
              ? { fg: 'var(--sf-warning)', bg: 'var(--sf-warning-bg)' }
              : { fg: 'var(--sf-accent)', bg: 'var(--sf-accent-soft)' }
    const machineStatusColor = statusColorToken(workOrder.machineStatus)

    const handleSaveNotes = () => {
        onPatch(workOrder, { description: notesDraft }, 'Work order notes saved')
        setEditingNotes(false)
    }

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
            <aside
                className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] shadow-2xl border-l flex flex-col overflow-hidden"
                style={{ background: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }}
                aria-label="Work order details"
            >
                {/* Header */}
                <div
                    className="px-5 h-16 border-b flex items-center justify-between gap-2 shrink-0"
                    style={{ borderColor: 'var(--sf-border)' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Wrench className="w-4 h-4 shrink-0" style={{ color: typeTone.fg }} />
                        <span className="sf-ops-num text-xs font-bold uppercase tracking-wider truncate">
                            {workOrder.ticketNumber}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border cursor-pointer transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                        aria-label="Close work order drawer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5 overflow-y-auto sf-ops-scroll flex-1">
                    {/* Type, Overdue & Title */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: typeTone.bg, color: typeTone.fg }}
                            >
                                {workOrder.type}
                            </span>
                            {workOrder.isOverdue && (
                                <span
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                    style={{ background: 'var(--sf-error-bg)', color: 'var(--sf-error)' }}
                                >
                                    Overdue
                                </span>
                            )}
                        </div>
                        <h3 className="text-[15px] font-bold leading-snug">{workOrder.title}</h3>
                    </div>

                    {/* 1-Click Status Workflow */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            Workflow Status
                        </div>
                        <div
                            className="grid grid-cols-4 p-1 rounded-xl border gap-1"
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                        >
                            {STATUS_STEPS.map(step => {
                                const active = workOrder.status === step.value
                                return (
                                    <button
                                        key={step.value}
                                        type="button"
                                        disabled={isBusy || active}
                                        onClick={() =>
                                            onPatch(
                                                workOrder,
                                                { status: step.value },
                                                `${workOrder.ticketNumber} → ${step.label}`,
                                            )
                                        }
                                        className="py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:cursor-default whitespace-nowrap"
                                        style={
                                            active
                                                ? {
                                                      background: 'var(--sf-surface)',
                                                      color:
                                                          step.value === 'Resolved'
                                                              ? 'var(--sf-running)'
                                                              : step.value === 'Review'
                                                                ? '#9333ea'
                                                                : 'var(--sf-accent)',
                                                      boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                                  }
                                                : { color: 'var(--sf-muted)' }
                                        }
                                    >
                                        {step.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Assignee & Schedule */}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                            <label
                                htmlFor="wo-drawer-assignee"
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--sf-muted)' }}
                            >
                                <User className="w-3 h-3" />
                                <span>Assigned Technician</span>
                            </label>
                            <select
                                id="wo-drawer-assignee"
                                disabled={isBusy}
                                value={workOrder.assignedUserId ?? ''}
                                onChange={e => {
                                    const nextId = e.target.value
                                    if (!nextId) {
                                        onPatch(workOrder, { clearAssignee: true }, 'Assignee cleared')
                                    } else {
                                        const person = assignees.find(a => a.userId === nextId)
                                        onPatch(
                                            workOrder,
                                            { assignedUserId: nextId },
                                            `Assigned to ${person?.fullName ?? 'technician'}`,
                                        )
                                    }
                                }}
                                className="w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none cursor-pointer disabled:opacity-50"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border)',
                                    color: 'var(--sf-text)',
                                }}
                            >
                                <option value="">Unassigned</option>
                                {assignees.map(a => (
                                    <option key={a.userId} value={a.userId}>
                                        {a.fullName} ({a.activeWorkOrdersCount} active)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div
                            className="rounded-xl border p-3 space-y-2 text-xs"
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5" style={{ color: 'var(--sf-muted)' }}>
                                    <Calendar className="w-3.5 h-3.5" />
                                    Due Date
                                </span>
                                <span
                                    className="sf-ops-num font-bold"
                                    style={{ color: workOrder.isOverdue ? 'var(--sf-error)' : 'var(--sf-text)' }}
                                >
                                    {formatExactDate(workOrder.dueDateUtc)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5" style={{ color: 'var(--sf-muted)' }}>
                                    <Clock className="w-3.5 h-3.5" />
                                    Created
                                </span>
                                <span className="sf-ops-num font-medium" style={{ color: 'var(--sf-text-2)' }}>
                                    {formatExactDate(workOrder.createdAtUtc)}
                                </span>
                            </div>
                            {workOrder.resolvedAtUtc && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5" style={{ color: 'var(--sf-running)' }}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Resolved
                                    </span>
                                    <span className="sf-ops-num font-semibold" style={{ color: 'var(--sf-running)' }}>
                                        {formatExactDate(workOrder.resolvedAtUtc)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scope / Maintenance Notes */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                                Maintenance Notes
                            </span>
                            {!editingNotes && (
                                <button
                                    type="button"
                                    onClick={() => setEditingNotes(true)}
                                    className="text-[11px] font-semibold cursor-pointer hover:underline"
                                    style={{ color: 'var(--sf-accent)' }}
                                >
                                    Edit
                                </button>
                            )}
                        </div>

                        {editingNotes ? (
                            <div className="space-y-2">
                                <textarea
                                    rows={4}
                                    value={notesDraft}
                                    onChange={e => setNotesDraft(e.target.value)}
                                    className="w-full p-3 rounded-xl border text-xs outline-none resize-none"
                                    style={{
                                        background: 'var(--sf-surface-2)',
                                        borderColor: 'var(--sf-accent)',
                                        color: 'var(--sf-text)',
                                    }}
                                    placeholder="Add service steps, parts replaced, or findings…"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNotesDraft(workOrder.description ?? '')
                                            setEditingNotes(false)
                                        }}
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer"
                                        style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={handleSaveNotes}
                                        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                                    >
                                        Save Notes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="rounded-xl border p-3 text-xs leading-relaxed break-words"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border)',
                                    color: workOrder.description ? 'var(--sf-text-2)' : 'var(--sf-muted)',
                                }}
                            >
                                {workOrder.description || 'No notes recorded yet.'}
                            </div>
                        )}
                    </div>

                    {/* Affected Machine */}
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
                            Target Asset
                        </div>
                        <div
                            className="rounded-xl border p-3.5 space-y-2.5"
                            style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Cpu className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sf-muted)' }} />
                                        <span className="text-xs font-bold truncate">{workOrder.machineName}</span>
                                    </div>
                                    <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--sf-muted)' }}>
                                        {workOrder.productionLineName ?? 'Standalone Utility'} ·{' '}
                                        {shortHallPillName(workOrder.factoryHallName)}
                                    </div>
                                </div>
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                    style={{
                                        background: `color-mix(in srgb, ${machineStatusColor} 14%, transparent)`,
                                        color: machineStatusColor,
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: machineStatusColor }} />
                                    {workOrder.machineStatus}
                                </span>
                            </div>

                            <div
                                className="flex items-center justify-between pt-2 border-t text-[11px]"
                                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-muted)' }}
                            >
                                <span className="sf-ops-num">
                                    {workOrder.machineSerialNumber ? `SN: ${workOrder.machineSerialNumber}` : 'Asset'}
                                </span>
                                <Link
                                    to={`/machines/${workOrder.machineId}`}
                                    className="inline-flex items-center gap-1 font-bold hover:underline"
                                    style={{ color: 'var(--sf-accent)' }}
                                >
                                    <span>Machine Details</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="p-4 border-t space-y-2 shrink-0"
                    style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-surface)' }}
                >
                    <div className="flex items-center gap-2">
                        {workOrder.status === 'Open' && (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                    onPatch(workOrder, { status: 'InProgress' }, `${workOrder.ticketNumber} started`)
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                            >
                                <Play className="w-3.5 h-3.5" />
                                <span>Start Work</span>
                            </button>
                        )}
                        {workOrder.status === 'InProgress' && (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                    onPatch(workOrder, { status: 'Review' }, `${workOrder.ticketNumber} moved to Review & Test`)
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Send to Review</span>
                            </button>
                        )}
                        {workOrder.status === 'Review' && (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                    onPatch(workOrder, { status: 'Resolved' }, `${workOrder.ticketNumber} resolved`)
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve & Resolve</span>
                            </button>
                        )}
                        {workOrder.status === 'Resolved' && (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                    onPatch(workOrder, { status: 'Open' }, `${workOrder.ticketNumber} reopened`)
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-50"
                                style={{
                                    background: 'var(--sf-surface-2)',
                                    borderColor: 'var(--sf-border-strong)',
                                    color: 'var(--sf-text)',
                                }}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reopen Work Order</span>
                            </button>
                        )}

                        {canManageMachines && (
                            confirmDelete ? (
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => onDelete(workOrder)}
                                    className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50 shrink-0"
                                >
                                    Confirm Delete
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setConfirmDelete(true)}
                                    className="p-2 rounded-xl border cursor-pointer transition-colors hover:opacity-80 disabled:opacity-50 shrink-0"
                                    style={{
                                        borderColor: 'var(--sf-border)',
                                        color: 'var(--sf-error)',
                                        background: 'var(--sf-surface-2)',
                                    }}
                                    title="Delete work order"
                                    aria-label="Delete work order"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
