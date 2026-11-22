import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, AlertCircle, SquarePen, CheckCircle, ListOrdered, Activity, RotateCcw, ShieldCheck, TrendingDown, Timer, PackageCheck } from "lucide-react";
import useMachineDetails from "../../hooks/useMachineDetails";
import useUpdateThresholds from "../../hooks/useUpdateThresholds";
import Header from "../layout/Header";
import SimulationDrawer from '../simulation/SimulationDrawer';
import TelemetryHistoryChart from '../simulation/TelemetryHistoryChart';
import { useSimulationMachine } from '../../hooks/useSimulationMachine';
import { telemetryTimestamp } from '../../utils/telemetrySeries';
import SimulationProperties from '../simulation/SimulationProperties';
import SimulationCondition from '../simulation/SimulationCondition';
import StatusBadge from "../common/StatusBadge";
import { CreateAlertThresholdsDto, MachineDetailDto } from "../../types/machine";
import { useMemo, useState, useEffect, useRef } from "react";
import AddMachineModal from "./AddMachineModal";
import { useAuth } from '../../context/AuthContext';

const ORDER_LABELS: Record<number, string> = {
    1: 'st',
    2: 'nd',
    3: 'rd'
}

function getOrderLabel(key: number): string {
    return ORDER_LABELS[key] || 'th';
}

function formatUpTime(dateStr: string | null | undefined, status: string) {
    if (!dateStr || (status !== 'Running' && status !== 'Warning')) {
        return ' --- ';
    }

    const normalizedDateStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`;
    const diffMs = Math.max(0, Date.now() - new Date(normalizedDateStr).getTime());
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    return minutes >= 60
        ? (days > 0 ? `${days}d ${remHours}h` : `${hours}h`)
        : (minutes === 0 ? '0 minutes' : `${minutes} minutes`);
}

function getTotalOperatingHours(machine: MachineDetailDto): string {
    const baseHours = machine.totalOperatingHours || 0;
    if ((machine.status === 'Running' || machine.status === 'Warning') && machine.lastStatusChangedAt) {
        const dateStr = machine.lastStatusChangedAt;
        const normalizedDateStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`;
        const diffMs = Math.max(0, Date.now() - new Date(normalizedDateStr).getTime());
        const elapsedHours = diffMs / (1000 * 60 * 60);
        return `${(baseHours + elapsedHours).toFixed(0)}h`;
    }
    return `${baseHours.toFixed(0)}h`;
}

export default function MachineDetails() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const canManage = user?.role === 'SuperAdmin' || user?.role === 'HallAdmin';
    const { machine, isLoading, error, refetch } = useMachineDetails(id);
    const { machine: simulation, error: simulationError, refresh: refreshSimulation, connectionStatus } = useSimulationMachine(id ?? '');
    const live = simulation?.machineId === id ? simulation : null;
    const latestSaved = machine?.latestTelemetry.reduce((latest, sample) =>
        !latest || telemetryTimestamp(sample.timestamp) > telemetryTimestamp(latest.timestamp) ? sample : latest,
        null as MachineDetailDto['latestTelemetry'][number] | null);
    const currentTelemetry = live?.state ?? latestSaved;
    const value = (number: number | null | undefined) => typeof number === 'number' && Number.isFinite(number)
        ? number.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : '—';
    const { execute, isSaving, errorThresholds } = useUpdateThresholds()
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const observedStatus = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!live || isModalOpen) return;
        const key = `${live.machineId}/${live.machineStatus}`;
        if (observedStatus.current !== undefined && observedStatus.current !== key) void refetch(undefined, true);
        observedStatus.current = key;
    }, [live?.machineId, live?.machineStatus, isModalOpen, refetch]);

    const [tempWarning, setTempWarning] = useState<number | string>(70);
    const [tempCritical, setTempCritical] = useState<number | string>(85);
    const [vibWarning, setVibWarning] = useState<number | string>(2.0);
    const [vibCritical, setVibCritical] = useState<number | string>(3.5);

    const handleThresholds = async () => {
        if (!machine) return;

        const thresholdsToSave: CreateAlertThresholdsDto[] = [
            {
                metricType: "Temperature",
                warningValue: Number(tempWarning),
                criticalValue: Number(tempCritical)
            },
            {
                metricType: "Vibration",
                warningValue: Number(vibWarning),
                criticalValue: Number(vibCritical)
            }
        ]

        try {
            await execute(machine.id, thresholdsToSave);
            refetch();
            setSuccessMessage("Alert thresholds updated successfully")
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err) { }
    }

    const parsedProperties = useMemo(() => {
        if (!machine?.staticProperties) return {}
        try {
            return JSON.parse(machine.staticProperties) as Record<string, any>
        } catch (e) {
            console.error("Failed to parse staticPropeties JSON:", e)
            return {};
        }
    }, [machine?.staticProperties])

    const navigate = useNavigate()

    const handleSuccess = () => {
        refetch();
        void refreshSimulation();
        setSuccessMessage("Machine updated successfully!");
        setTimeout(() => {
            setSuccessMessage(null);
        }, 4000);
    };

    const thresholdKey = JSON.stringify(machine?.alertThresholds);
    useEffect(() => {
        if (machine?.alertThresholds) {
            const temp = machine.alertThresholds.find(t => t.metricType === "Temperature");
            if (temp) {
                setTempWarning(temp.warningValue);
                setTempCritical(temp.criticalValue);
            }
            const vib = machine.alertThresholds.find(t => t.metricType === "Vibration");
            if (vib) {
                setVibWarning(vib.warningValue);
                setVibCritical(vib.criticalValue);
            }
        }
    }, [thresholdKey]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top Bar / Header */}
            <Header
                showHallSelector={false}
                leftContent={
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <div className="text-xs text-slate-400 font-medium mb-0.5">
                                Machine Fleet / Details
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-800">
                                    {machine ? machine.name : "Loading..."}
                                </h1>
                                {machine && <StatusBadge status={live?.machineStatus ?? machine.status} />}
                                <span className="text-xs font-mono text-slate-400">
                                    ID: {machine?.serialNumber || id}
                                </span>
                            </div>
                        </div>
                    </div>
                }
                rightContent={
                    <>
                        <button className="flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span>Export PDF</span>
                        </button>
                        <button
                            disabled={!canManage}
                            onClick={() => setIsModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                        >
                            <SquarePen className="w-4 h-4" />
                            <span>Edit Machine</span>
                        </button>
                    </>
                }
            />

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {/* Success Banner */}
                {successMessage && (
                    <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="text-green-700 hover:text-green-900 font-bold text-sm px-2 py-1 rounded"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm font-semibold">Loading machine details...</span>
                    </div>
                )}

                {(error || errorThresholds || simulationError) && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-sm font-semibold">{error || errorThresholds || simulationError}</span>
                    </div>
                )}

                {!isLoading && !error && machine && (
                    <div className="space-y-6">
                        {/* 1. Top Metrics Grid */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Temp</div>
                                <div className="text-3xl font-bold text-slate-800">{value(currentTelemetry?.temperature)} <span className="text-base text-slate-400">°C</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Vibration</div>
                                <div className="text-3xl font-bold text-slate-800">{value(currentTelemetry?.vibration)} <span className="text-base text-slate-400">mm/s</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Energy Load</div>
                                <div className="text-3xl font-bold text-yellow-600">{value(currentTelemetry?.powerLoadKw)} <span className="text-base text-yellow-500">kW</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Network Ping</div>
                                <div className="text-3xl font-bold text-blue-600">{value(currentTelemetry && 'networkLatencyMs' in currentTelemetry ? currentTelemetry.networkLatencyMs : null)} <span className="text-base text-blue-400">ms</span></div>
                            </div>
                        </div>

                        {!live?.state && latestSaved && <p className="text-xs text-slate-500">
                            Last saved reading: {new Date(telemetryTimestamp(latestSaved.timestamp)).toLocaleString('en-GB')}. Live telemetry is unavailable.
                        </p>}

                        {/* 2. Main Grid */}
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-3">

                            {/* Left Side (Charts, Analytics, Incidents) */}
                            <div className="2xl:col-span-2 space-y-6">

                                <TelemetryHistoryChart key={machine.id} machineId={machine.id} state={live?.state ?? null}
                                    tickIntervalMs={live?.profile?.tickIntervalMs} connectionStatus={connectionStatus} />
                                <SimulationCondition machine={live} />

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100">
                                        <h2 className="text-lg font-bold text-slate-800">Recent Incidents</h2>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                                <tr>
                                                    <th className="px-6 py-3">Time</th>
                                                    <th className="px-6 py-3">Event</th>
                                                    <th className="px-6 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {machine.recentIncidents.map(incident => <tr key={incident.id}>
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(telemetryTimestamp(incident.triggeredAt)).toLocaleString('en-GB')}</td>
                                                    <td className="max-w-md whitespace-normal px-6 py-4 text-slate-700">{incident.message}</td>
                                                    <td className="px-6 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${incident.status === 'Active' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{incident.status}</span></td>
                                                </tr>)}
                                                {machine.recentIncidents.length === 0 && <tr><td colSpan={3} className="px-6 py-4 text-slate-500">No recorded incidents.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side (KPIs, Properties, Config) */}
                            <div className="space-y-6">

                                <SimulationProperties machine={live} properties={parsedProperties} />

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Production KPIs</h2>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <ListOrdered className="w-4 h-4 text-slate-600 shrink-0" />
                                                <span>Order in Line</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-600 font-mono">{machine.orderInLine}{getOrderLabel(machine.orderInLine)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <Activity className="w-4 h-4 text-slate-800 shrink-0" />
                                                <span>Continuous Operation</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{formatUpTime(machine.lastStatusChangedAt, machine.status)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <RotateCcw className="w-4 h-4 text-slate-800 shrink-0" />
                                                <span>Cycle Time</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{machine.cycleTimeSeconds}s</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <ShieldCheck className="w-4 h-4 text-slate-800 shrink-0" />
                                                <span>MTBF <span className="text-[10px] text-slate-400 font-normal ml-1">(Mean Time Btw Failures)</span></span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 font-mono">—</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                                                <span>Scrap Rate</span>
                                            </div>
                                            <span className="text-sm font-bold text-red-500 font-mono">—</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <Timer className="w-4 h-4 text-slate-800 shrink-0" />
                                                <span>Total Operating Hours</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{getTotalOperatingHours(machine)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <PackageCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                                                <span>Total Produced <span className="text-[10px] text-slate-400 font-normal ml-1">(Lifetime count)</span></span>
                                            </div>
                                            <span className="text-sm font-bold text-indigo-600 font-mono">{live?.state?.totalProduced ?? machine.totalProduced}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Threshold Config</h2>

                                    <div className="space-y-5">
                                        <div>
                                            <div className="text-xs font-bold text-slate-700 mb-2">Temperature Limit (°C)</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-yellow-600 uppercase mb-1">Warning</label>
                                                    <input type="number" value={tempWarning} onChange={(e) => setTempWarning(e.target.value)} step="0.1" className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Critical</label>
                                                    <input type="number" value={tempCritical} onChange={(e) => setTempCritical(e.target.value)} className="w-full px-3 py-1.5 border border-red-300 rounded text-sm font-bold text-red-700 outline-none focus:ring-1 focus:ring-red-500" />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-bold text-slate-700 mb-2">Vibration Limit (mm/s)</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-yellow-600 uppercase mb-1">Warning</label>
                                                    <input type="number" value={vibWarning} onChange={(e) => setVibWarning(e.target.value)} step="0.1" className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Critical</label>
                                                    <input type="number" value={vibCritical} onChange={(e) => setVibCritical(e.target.value)} className="w-full px-3 py-1.5 border border-red-300 rounded text-sm font-bold text-red-700 outline-none focus:ring-1 focus:ring-red-500" />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            disabled={!canManage || isSaving}
                                            onClick={() => handleThresholds()}
                                            className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2 rounded transition-colors mt-2">
                                            {isSaving ? "Saving..." : "Save Thresholds"}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
            {live && <SimulationDrawer key={live.machineId} machine={live} connectionStatus={connectionStatus}
                onChange={() => { void refreshSimulation(); void refetch(undefined, true); }} />}
            <AddMachineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                initialData={machine}
            />
        </div>
    );
}
