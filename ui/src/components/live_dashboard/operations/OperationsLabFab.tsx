import { useState } from 'react'
import {
    CheckCircle2,
    Flame,
    FlaskConical,
    PanelRight,
    Pause,
    Play,
    RefreshCw,
    SquareStack,
    X,
} from 'lucide-react'

export type DockLayoutVariant = 'sidebar' | 'dock'

interface OperationsLabFabProps {
    isPaused: boolean
    canRunSimulation: boolean
    busyAction: string | null
    layoutVariant: DockLayoutVariant
    offsetForRightSidebar: boolean
    onLayoutVariantChange: (variant: DockLayoutVariant) => void
    onTogglePause: () => void
    onRefreshNow: () => void
    onTestFault: () => void
    onRecoverAll: () => void
}

export default function OperationsLabFab({
    isPaused,
    canRunSimulation,
    busyAction,
    layoutVariant,
    offsetForRightSidebar,
    onLayoutVariantChange,
    onTogglePause,
    onRefreshNow,
    onTestFault,
    onRecoverAll,
}: OperationsLabFabProps) {
    const [open, setOpen] = useState(false)

    const positionClass = offsetForRightSidebar
        ? 'fixed bottom-5 right-5 xl:right-[326px] 2xl:right-[342px] z-50'
        : 'fixed bottom-5 right-5 z-50'

    const isBusy = busyAction !== null

    return (
        <div className={positionClass}>
            {open && (
                <div
                    role="dialog"
                    aria-label="Simulation Lab Controls"
                    className="sf-ops-toast mb-3 w-[306px] max-w-[calc(100vw-2.5rem)] rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl"
                    style={{
                        background: 'color-mix(in srgb, var(--sf-surface) 94%, #5b21b6 6%)',
                        borderColor: 'rgba(139, 92, 246, 0.45)',
                        boxShadow: '0 20px 50px -15px rgba(109, 40, 217, 0.38)',
                    }}
                >
                    <div
                        className="px-4 py-3 flex items-center justify-between gap-2 text-white"
                        style={{
                            background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 55%, #9333ea 100%)',
                        }}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                                <FlaskConical className="w-4 h-4 text-white" />
                            </span>
                            <div className="min-w-0">
                                <div className="text-xs font-extrabold tracking-tight leading-tight">
                                    Simulation Lab
                                </div>
                                <div className="text-[10px] text-violet-100/90 font-medium">
                                    4th-Wall Controls &amp; Layout
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                            aria-label="Close Simulation Lab"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-3.5 space-y-3.5">
                        {/* Right Panel Layout Switcher (Sidebar vs Card Dock) */}
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">
                                Right Panel Layout
                            </div>
                            <div
                                className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border"
                                style={{ background: 'var(--sf-surface-2)', borderColor: 'var(--sf-border)' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => onLayoutVariantChange('sidebar')}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                    style={
                                        layoutVariant === 'sidebar'
                                            ? {
                                                  background: '#7c3aed',
                                                  color: '#ffffff',
                                                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
                                              }
                                            : { color: 'var(--sf-muted)' }
                                    }
                                >
                                    <PanelRight className="w-3.5 h-3.5" />
                                    <span>Sidebar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onLayoutVariantChange('dock')}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                    style={
                                        layoutVariant === 'dock'
                                            ? {
                                                  background: '#7c3aed',
                                                  color: '#ffffff',
                                                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
                                              }
                                            : { color: 'var(--sf-muted)' }
                                    }
                                >
                                    <SquareStack className="w-3.5 h-3.5" />
                                    <span>Card Dock</span>
                                </button>
                            </div>
                        </div>

                        {/* Live Telemetry & Backend Simulation Controls */}
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">
                                Telemetry &amp; Simulation
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={onTogglePause}
                                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors"
                                    style={{
                                        background: isPaused ? 'var(--sf-warning-bg)' : 'var(--sf-surface-2)',
                                        borderColor: isPaused ? 'var(--sf-warning)' : 'var(--sf-border)',
                                        color: isPaused ? 'var(--sf-warning)' : 'var(--sf-text)',
                                    }}
                                >
                                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                    <span>{isPaused ? 'Resume Feed' : 'Pause Feed'}</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={onRefreshNow}
                                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                                    style={{
                                        background: 'var(--sf-surface-2)',
                                        borderColor: 'var(--sf-border)',
                                        color: 'var(--sf-text-2)',
                                    }}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'refresh' ? 'animate-spin' : ''}`} />
                                    <span>Refresh</span>
                                </button>

                                {canRunSimulation && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={onTestFault}
                                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                                            style={{
                                                background: 'var(--sf-error-bg)',
                                                borderColor: 'color-mix(in srgb, var(--sf-error) 50%, var(--sf-border))',
                                                color: 'var(--sf-error)',
                                            }}
                                            title="Triggers Overheating scenario on a running machine via Simulation API"
                                        >
                                            <Flame className="w-3.5 h-3.5" />
                                            <span>{busyAction === 'fault' ? 'Triggering…' : 'Test Fault'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={onRecoverAll}
                                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                                            style={{
                                                background: 'var(--sf-running-bg)',
                                                borderColor: 'color-mix(in srgb, var(--sf-running) 50%, var(--sf-border))',
                                                color: 'var(--sf-running)',
                                            }}
                                            title="Repairs faulted units and starts halted production lines"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>{busyAction === 'recover-all' ? 'Recovering…' : 'Recover All'}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Circular Floating Purple Lab Button */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    aria-expanded={open}
                    aria-label="Open Simulation Lab controls"
                    title="Simulation Lab & Layout Controls"
                    className="group relative w-14 h-14 rounded-full text-white flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/60"
                    style={{
                        background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 52%, #a21caf 100%)',
                        boxShadow:
                            '0 10px 28px -6px rgba(124, 58, 237, 0.65), 0 0 0 3px rgba(139, 92, 246, 0.22)',
                    }}
                >
                    {!open && (
                        <span
                            className="sf-ops-beacon-ring pointer-events-none absolute inset-0 rounded-full border-2 border-violet-400/60"
                            aria-hidden="true"
                        />
                    )}
                    {open ? (
                        <X className="w-6 h-6 transition-transform duration-200" />
                    ) : (
                        <FlaskConical className="w-6 h-6 transition-transform duration-200 group-hover:rotate-[-8deg]" />
                    )}
                    <span
                        className="absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-violet-900"
                        style={{ background: isPaused ? '#fbbf24' : '#34d399' }}
                        title={isPaused ? 'Feed paused' : 'Live feed active'}
                    />
                </button>
            </div>
        </div>
    )
}
