import { Play, Square, Settings, Loader2, AlertCircle } from 'lucide-react';
import { ProductionLineDto } from "../../types/production";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMachinesByProductionHallId, useProductionLineActions } from '../../hooks/useProductionLines';
import MachineIcon from '../common/MachineIcon';
import { MachineProductionLineDto } from '../../types/machine';

interface ProductionLineCardProps {
    line: ProductionLineDto
    onStatusChange?: () => void
}

function formatUpTime(dateStr: string | null | undefined, status: string) {
    if (status === 'Halted' || !dateStr || (status !== 'Running' && status !== 'Warning')) {
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

function getThroughPut(machines: MachineProductionLineDto[], lineStatus: string) {
    if ((lineStatus != "Running" && lineStatus != "Warning") || machines.length <= 0) return '0 units/h'

    const maxCycleTime = Math.max(...machines.map(m => m.cycleTimeSeconds || 5.0))
    const throughput = Math.floor(3600 / maxCycleTime)

    return `${throughput} units/h`
}

function getDailyOutput(machines: MachineProductionLineDto[]) {
    if (machines.length <= 0) return ' --- '

    const lastMachine = machines[machines.length - 1]

    return `${lastMachine.totalProduced}`
}

function getScrapRate(machines: MachineProductionLineDto[], lineStatus: string) {
    if (machines.length <= 0) return '0.0%';

    const totalParts = machines.reduce((acc, m) => acc + m.totalProduced, 0);

    // Mała wariacja w zakresie 0.1% - 0.5% zmieniająca się co kilka sztuk:
    const jitter = ((totalParts % 7) * 0.08);

    // 1. Awaria / Zatrzymanie linii (4.2% - 4.7%)
    if (lineStatus === 'Halted' || machines.some(m => m.status === 'Error')) {
        const rate = (4.2 + jitter).toFixed(1);
        return `${rate}%`;
    }
    // 2. Ostrzeżenie / Wibracje / Przegrzanie (2.3% - 2.8%)
    if (lineStatus === 'Warning' || machines.some(m => m.status === 'Warning')) {
        const rate = (2.3 + jitter).toFixed(1);
        return `${rate}%`;
    }
    // 3. Normalna praca (0.6% - 1.1%)
    const rate = (0.6 + jitter).toFixed(1);

    return `${rate}%`;

}

interface MachineFlowItemProps {
    machine: MachineProductionLineDto;
    isLast: boolean;
    lineStatus: string;
}

function MachineFlowItem({ machine, isLast, lineStatus }: MachineFlowItemProps) {
    const isHalted = lineStatus === 'Halted';
    const isError = machine.status === 'Error' || machine.status === 'Offline';
    const [pulseKey, setPulseKey] = useState<number>(0);
    const [particles, setParticles] = useState<{ id: number }[]>([]);

    useEffect(() => {
        if (isHalted || isError || machine.cycleTimeSeconds <= 0) return;

        const emit = () => {
            const now = Date.now();
            setPulseKey(now);
            if (!isLast) {
                setParticles((prev) => [...prev.slice(-3), { id: now }]);
            }
        };

        emit();

        const interval = setInterval(emit, machine.cycleTimeSeconds * 1000);
        return () => clearInterval(interval);
    }, [machine.cycleTimeSeconds, isHalted, isError, isLast]);

    return (
        <div className="flex items-center flex-1">
            {/* Machine Column Container */}
            <div className="flex flex-col items-center w-28 shrink-0 group cursor-pointer">
                {/* Status Badge (Above Machine Icon) */}
                <span
                    className={`text-[9px] font-extrabold uppercase mb-3 px-2 py-0.5 rounded border leading-none ${machine.status === 'Running'
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : machine.status === 'Warning'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : machine.status === 'Error'
                                ? 'text-red-700 bg-red-50 border-red-200'
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                        }`}
                >
                    {machine.status}
                </span>

                <Link
                    to={`/machines/${machine.id}`}
                    className="flex flex-col items-center w-full no-underline"
                >
                    {/* Machine Icon Card */}
                    <div
                        className={`w-16 h-16 rounded-2xl bg-white border-2 shadow-md flex items-center justify-center mb-2 transition-all group-hover:scale-105 ${machine.status === 'Running'
                            ? 'border-green-500 text-green-600 shadow-green-50'
                            : machine.status === 'Warning' || machine.status === 'Maintenance'
                                ? 'border-amber-400 text-amber-500 ring-4 ring-amber-100'
                                : machine.status === 'Error'
                                    ? 'border-red-500 text-red-600 ring-4 ring-red-100 bg-red-50'
                                    : 'border-slate-300 text-slate-400'
                            }`}
                    >
                        <MachineIcon name={machine.icon} />
                    </div>

                    {/* Machine Name */}
                    <span className="font-bold text-xs text-slate-700 text-center leading-[16px]">
                        {machine.name}
                    </span>
                </Link>

                {/* Cycle Time Label */}
                <span className="text-[10px] text-slate-400 font-mono mt-2">
                    CT: {machine.cycleTimeSeconds > 0 ? `${machine.cycleTimeSeconds}s` : 'N/A'}
                </span>

                <div className="mt-4 relative z-20 shrink-0">
                    <div
                        key={`diamond-${pulseKey}`}
                        className={`w-2.5 h-2.5 rotate-45 border border-white shadow-xs shrink-0 transition-colors ${isHalted || isError
                            ? 'bg-slate-400'
                            : pulseKey > 0
                                ? 'bg-blue-600 animate-diamond-glow'
                                : 'bg-blue-600'
                            }`}
                    />
                </div>
            </div>

            {!isLast && (
                <div className="flex-1 relative h-[3px] bg-blue-200 self-end mb-[3px] overflow-visible">
                    {particles.map((p) => (
                        <div
                            key={p.id}
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full shadow-sm shadow-blue-400 animate-particle-fly"
                            onAnimationEnd={() => {
                                setParticles((prev) => prev.filter((item) => item.id !== p.id));
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ProductionLineCard({ line, onStatusChange }: ProductionLineCardProps) {

    const { machines, isLoading: isLoadingMachines, error: errorMachines, refetch: reloadMachines } = useMachinesByProductionHallId(line.id)
    const { haltLine, startLine, isActionLoading, actionError, clearStatus } = useProductionLineActions()

    const handleHalt = async () => {
        const ok = await haltLine(line.id);
        if (ok) {
            await reloadMachines();
            onStatusChange?.();
        }
    };

    const handleStart = async () => {

        const ok = await startLine(line.id);
        if (ok) {
            await reloadMachines();
            onStatusChange?.();
        }
    };

    const scrapRateStr = getScrapRate(machines, line.status);
    const scrapRateVal = parseFloat(scrapRateStr);
    const scrapRateColor =
        scrapRateVal >= 4.2
            ? 'text-red-600'
            : scrapRateVal >= 2.3
                ? 'text-amber-600'
                : 'text-green-600';

    return (
        <>
            {isLoadingMachines && (
                <div className="flex justify-center items-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <Loader2 className="w-7 h-7 animate-spin mr-3 text-blue-600" />
                    <span className="text-sm font-medium">Loading machine data...</span>
                </div>
            )}

            {errorMachines && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <p className="text-sm font-medium">{errorMachines}</p>
                </div>
            )}
            {!isLoadingMachines && !errorMachines && machines && (
                <div key={line.id}
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all 
                ${line.status === 'Halted' ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}
                >{/* Card Header */}
                    <div
                        className={`p-6 border-b flex flex-wrap justify-between items-center gap-4 
                        ${line.status === 'Halted' ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div
                                className={`w-3 h-3 rounded-full ${line.status === 'Running'
                                    ? 'bg-green-500 animate-pulse'
                                    : line.status === 'Warning'
                                        ? 'bg-amber-500 animate-pulse'
                                        : 'bg-red-500'
                                    }`}
                            />
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    {line.orderInHall != null ? `L${line.orderInHall}: ` : ''}{line.name}
                                    <span
                                        className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-md border 
                                            ${line.status === 'Running'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : line.status === 'Warning'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }`}
                                    >
                                        {line.status}
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                    ID: {line.orderInHall != null ? `L${line.orderInHall}` : line.name} | Uptime: {formatUpTime(line.lastStatusChangedAt, line.status)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Throughput</div>
                                <div className="font-bold text-slate-800 font-mono text-base">{getThroughPut(machines, line.status)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Scrap Rate</div>
                                <div className={`font-bold font-mono text-base ${scrapRateColor}`}>
                                    {scrapRateStr}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Produced</div>
                                <div className="font-bold text-blue-600 font-mono text-base">{getDailyOutput(machines)}</div>
                            </div>
                            <div className="pl-4 border-l border-slate-200 flex gap-2">
                                {line.status !== 'Halted' ? (
                                    <button
                                        onClick={handleHalt}
                                        disabled={isActionLoading}
                                        title="Halt production line"
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isActionLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                        ) : (
                                            <Square className="w-4 h-4 fill-current" />
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStart}
                                        disabled={isActionLoading}
                                        title="Start production line"
                                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isActionLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                                        ) : (
                                            <Play className="w-4 h-4 fill-current" />
                                        )}
                                    </button>
                                )}
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Action Error Banner */}
                    {actionError && (
                        <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-red-700 flex items-center justify-between text-xs animate-fadeIn">
                            <div className="flex items-center gap-2 font-medium">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                <span>{actionError}</span>
                            </div>
                            <button
                                onClick={clearStatus}
                                className="text-red-500 hover:text-red-800 font-bold px-1.5 py-0.5 rounded text-xs transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Pipeline Visualization Area */}
                    <div className="px-8 py-7 overflow-x-auto">
                        {machines.length > 0 ? (
                            <div className="relative min-w-max pb-3">
                                {/* Main Conveyor Belt Background Line*/}
                                <div
                                    className={`absolute top-[72px] left-12 right-12 h-[10px] rounded-full z-0 
                                    ${line.status === 'Running'
                                            ? 'bg-green-500 conveyor-belt border border-green-600'
                                            : line.status === 'Warning'
                                                ? 'bg-amber-400 conveyor-belt border border-amber-500'
                                                : 'conveyor-halted border border-red-300'
                                        }`}
                                />
                                {/* Machines Row and Inter-Machine Cycle Flow */}
                                <div className="relative flex items-start justify-between gap-2 z-10 px-4">
                                    {machines.map((m, id) => (
                                        <MachineFlowItem
                                            key={m.id}
                                            machine={m}
                                            isLast={id === machines.length - 1}
                                            lineStatus={line.status}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                                <p className="text-sm font-semibold text-slate-700">No machines assigned to this line</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                    Assign machines to this production line in the Machine Fleet tab or create new machines.
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Keyframes for Particle Travel, Conveyor Belt & Diamond Port Glow Animations */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .conveyor-belt {
                        background-image: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px);
                        animation: moveConveyor 2s linear infinite;
                        }
                        @keyframes moveConveyor {
                        0% { background-position: 0 0; }
                        100% { background-position: 28px 0; }
                        }
                        .conveyor-halted {
                        background-image: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px);
                        background-color: #fee2e2;
                        animation: pulse-danger 2s ease-in-out infinite;
                        }
                        @keyframes pulse-danger {
                        0% { background-color: #fee2e2; }
                        50% { background-color: #f87171; box-shadow: 0 0 15px rgba(248, 113, 113, 0.4); }
                        100% { background-color: #fee2e2; }
                        }

                        @keyframes diamondGlow {
                        0% {
                            filter: drop-shadow(0 0 0px transparent);
                            box-shadow: 0 0 0 0 transparent;
                        }
                        20% {
                            filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.7));
                            box-shadow: 0 0 5px 1.5px rgba(96, 165, 250, 0.6);
                        }
                        100% {
                            filter: drop-shadow(0 0 0px transparent);
                            box-shadow: 0 0 0 0 transparent;
                        }
                        }

                        .animate-diamond-glow {
                        animation: diamondGlow 0.55s ease-out;
                        }

                        @keyframes particleFly {
                        0% {
                            left: 0%;
                            opacity: 0.2;
                            transform: translateY(-50%) scale(0.6);
                        }
                        10% {
                            opacity: 1;
                            transform: translateY(-50%) scale(1);
                        }
                        90% {
                            opacity: 1;
                            transform: translateY(-50%) scale(1);
                        }
                        100% {
                            left: 100%;
                            opacity: 0.2;
                            transform: translateY(-50%) scale(0.6);
                        }
                        }
                        .animate-particle-fly {
                        animation: particleFly 2.5s linear forwards;
                        }
                    `}} />
                </div>
            )}
        </>
    );
}