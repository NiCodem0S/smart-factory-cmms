import { Play, Square, Settings, Plus, Loader2, AlertCircle } from 'lucide-react';
import { ProductionLineDto } from "../../types/production";
import { useState, useEffect } from 'react';
import { useMachinesByProductionHallId } from '../../hooks/useProductionLines';

interface ProductionLineCardProps {
    line: ProductionLineDto
}

interface MachineItem {
    id: number;
    name: string;
    icon: React.ReactNode;
    status: 'running' | 'warning' | 'error' | 'offline';
    cycleTime: number; // in seconds
}

interface LineItem {
    id: number;
    lineCode: string;
    name: string;
    uptime: string;
    status: 'Running' | 'Warning' | 'Halted';
    throughput: string;
    scrapRate: string;
    total24h: string;
    machines: MachineItem[];
}

export default function ProductionLineCard({ line }: ProductionLineCardProps) {

    const { machines, isLoading: isLoadingMachines, error: errorMachines, refetch: reloadMachines } = useMachinesByProductionHallId(line.id)

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
                                    {line.name}
                                    <span
                                        className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-md border ${line.status === 'Running'
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
                                    ID: {line.name} | Uptime: ???
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Throughput</div>
                                <div className="font-bold text-slate-800 font-mono text-base">???</div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Scrap Rate</div>
                                <div
                                    className={`font-bold font-mono text-base ${parseFloat("12") > 2 ? 'text-amber-600' : 'text-green-600'
                                        }`}
                                >
                                    {"12"}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total (24h)</div>
                                <div className="font-bold text-blue-600 font-mono text-base">{"????"}</div>
                            </div>
                            <div className="pl-4 border-l border-slate-200 flex gap-2">
                                {line.status !== 'Halted' ? (
                                    <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Square className="w-4 h-4 fill-current" />
                                    </button>
                                ) : (
                                    <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                        <Play className="w-4 h-4 fill-current" />
                                    </button>
                                )}
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Pipeline Visualization Area */}
                    <div className="p-8 overflow-x-auto">
                        <div className="relative min-w-max pb-4">
                            {/* Main Conveyor Belt Background Line*/}
                            <div
                                className={`absolute top-[44px] left-12 right-12 h-[10px] rounded-full z-0 
                            ${line.status === 'Running'
                                        ? 'bg-green-500 conveyor-belt border border-green-600'
                                        : line.status === 'Warning'
                                            ? 'bg-amber-400 conveyor-belt border border-amber-500'
                                            : 'conveyor-halted border border-red-300'
                                    }`}
                            />
                            {/* Machines Row & Inter-Machine Cycle Flow */}
                            <div className="relative flex items-start justify-between gap-2 z-10 px-4">
                                {machines.map((m, id) => {
                                    const isLast = id === machines.length - 1

                                    return (
                                        <div key={m.id} className="flex items-center flex-1">

                                            {/*Machine Column Container*/}
                                            <div className='flex flex-col items-center w-28 shrink-0 group cursor-pointer'>
                                                {/* Machine Icon Card*/}
                                                <div
                                                    className={`w-16 h-16 rounded-2xl bg-white border-2 shadow-md flex items-center justify-center mb-2 transition-all group-hover:scale-105 ${m.status === 'Running'
                                                        ? 'border-green-500 text-green-600 shadow-green-50'
                                                        : m.status === 'Warning'
                                                            ? 'border-amber-400 text-amber-500 ring-4 ring-amber-100'
                                                            : m.status === 'Error'
                                                                ? 'border-red-500 text-red-600 ring-4 ring-red-100 bg-red-50'
                                                                : 'border-slate-300 text-slate-400'
                                                        }`}
                                                >
                                                    {m.icon}
                                                </div>
                                                {/* Machine Name */}
                                                <span className="font-bold text-xs text-slate-700 text-center leading-tight">
                                                    {m.name}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}