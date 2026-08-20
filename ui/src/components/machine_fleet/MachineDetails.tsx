import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react";
import useMachineDetails from "../../hooks/useMachineDetails";
import Header from "../layout/Header";
import StatusBadge from "../common/StatusBadge";

export default function MachineDetails() {
    const { id } = useParams<{ id: string }>();
    const { machine, isLoading, error } = useMachineDetails(id);

    const navigate = useNavigate()

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top Bar / Header */}
            <Header
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
                                {machine && <StatusBadge status={machine.status} />}
                                <span className="text-xs font-mono text-slate-400">
                                    ID: {machine?.serialNumber || id}
                                </span>
                            </div>
                        </div>
                    </div>
                }
                rightContent={
                    <button className="flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>Export PDF</span>
                    </button>
                }
            />

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {isLoading && (
                    <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm font-semibold">Loading machine details...</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-sm font-semibold">{error}</span>
                    </div>
                )}

                {!isLoading && !error && machine && (
                    <div className="space-y-6">
                        {/* 1. Top Metrics Grid */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Temp</div>
                                <div className="text-3xl font-bold text-slate-800">-- <span className="text-base text-slate-400">°C</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Vibration</div>
                                <div className="text-3xl font-bold text-slate-800">-- <span className="text-base text-slate-400">mm/s</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Energy Load</div>
                                <div className="text-3xl font-bold text-yellow-600">-- <span className="text-base text-yellow-500">kW</span></div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Network Ping</div>
                                <div className="text-3xl font-bold text-blue-600">-- <span className="text-base text-blue-400">ms</span></div>
                            </div>
                        </div>

                        {/* 2. Main Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                            {/* Left Side (Charts, Analytics, Incidents) */}
                            <div className="xl:col-span-2 space-y-6">

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Telemetry History</h2>
                                            <p className="text-xs text-slate-500">Live data stream (last 60 seconds)</p>
                                        </div>
                                        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                                            <button className="px-3 py-1 text-xs font-bold bg-white text-slate-800 rounded shadow-sm">Live</button>
                                            <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800">1H</button>
                                            <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800">24H</button>
                                        </div>
                                    </div>
                                    <div className="h-[300px] w-full relative bg-slate-50 rounded border border-slate-100 flex items-center justify-center">
                                        {/* To do: Recharts chart here */}
                                        <span className="text-slate-400 font-medium">Chart Area Placeholder</span>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Predictive Analytics</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                                        <div className="flex flex-col items-center justify-center md:col-span-1 pt-2">
                                            {/* Health Gauge Mockup */}
                                            <div className="relative w-[180px] h-[90px] overflow-hidden">
                                                <div
                                                    className="absolute top-0 left-0 w-[180px] h-[180px] rounded-full transition-all duration-700 ease-out"
                                                    style={{ background: 'conic-gradient(from 270deg, #22c55e 0deg, #22c55e 158.4deg, #f1f5f9 158.4deg, #f1f5f9 180deg, transparent 180deg)' }}
                                                ></div>
                                                <div className="absolute top-[15px] left-[15px] w-[150px] h-[150px] bg-white rounded-full"></div>
                                                <div className="absolute bottom-0 w-full text-center leading-none">
                                                    <span className="text-[40px] font-black text-green-500 transition-colors duration-500">88<span className="text-xl">%</span></span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-3">Machine Health</div>
                                        </div>

                                        <div className="md:col-span-2 md:border-l border-slate-100 md:pl-8 space-y-4">
                                            <div>
                                                <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Status: Optimal</h4>
                                                <p className="text-xs text-slate-500 leading-relaxed">Component wear is currently within normal operational limits. Vibration analysis shows minimal degradation on primary bearings.</p>
                                            </div>
                                            <div className="pt-4 border-t border-slate-100">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Est. Remaining Useful Life</div>
                                                        <div className="text-3xl font-bold text-slate-800">412 <span className="text-base text-slate-400 font-medium">hours</span></div>
                                                        <p className="text-xs text-slate-500 mt-1 flex items-center">
                                                            <span className="w-2 h-2 rounded-full bg-yellow-400 mr-1.5"></span> Next predicted failure: Main Servo
                                                        </p>
                                                    </div>

                                                    <button className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors flex items-center border border-blue-200 shadow-sm shrink-0">
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                        Schedule Maintenance
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

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
                                                <tr>
                                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">Today, 08:14</td>
                                                    <td className="px-6 py-4 text-slate-700">Network connection lost for 12 seconds.</td>
                                                    <td className="px-6 py-4"><span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Resolved</span></td>
                                                </tr>
                                                <tr>
                                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">Yesterday, 14:30</td>
                                                    <td className="px-6 py-4 text-slate-700">Vibration spike (warning threshold reached).</td>
                                                    <td className="px-6 py-4"><span className="text-slate-500 font-bold text-xs bg-slate-100 px-2 py-1 rounded">Archived</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side (KPIs, Properties, Config) */}
                            <div className="space-y-6">

                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Production KPIs</h2>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-slate-600">Operating Hours</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{machine.totalOperatingHours.toFixed(1)} h</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-slate-600">Cycle Time</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">4.2s</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-slate-600">MTBF <span className="text-[10px] text-slate-400 font-normal ml-1">(Mean Time Btw Failures)</span></span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">45d 12h</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-slate-600">Scrap Rate</span>
                                            <span className="text-sm font-bold text-red-500 font-mono">1.2%</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                            <span className="text-sm font-medium text-slate-600">Total Produced (24h)</span>
                                            <span className="text-sm font-bold text-indigo-600 font-mono">3,450</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-xl shadow-sm p-6 text-slate-300">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                                            <span className="mr-2">⚡</span> Specific Properties
                                        </h2>
                                        <span className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded text-slate-400">JSON</span>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-400">Category</span>
                                            <span className="font-mono font-bold text-white">{machine.category}</span>
                                        </div>
                                        {/* TODO: Add dynamically parsed JSON properties here */}
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-400">Joint Angle</span>
                                            <span className="font-mono font-bold text-white text-base">112°</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-400">Current Task</span>
                                            <span className="font-mono font-bold text-blue-400">WELDING_SEQ_4</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-400">Firmware Ver.</span>
                                            <span className="font-mono font-bold text-white">v2.4.1</span>
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
                                                    <input type="number" defaultValue="70" className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Critical</label>
                                                    <input type="number" defaultValue="85" className="w-full px-3 py-1.5 border border-red-300 rounded text-sm font-bold text-red-700 outline-none focus:ring-1 focus:ring-red-500" />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-bold text-slate-700 mb-2">Vibration Limit (mm/s)</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-yellow-600 uppercase mb-1">Warning</label>
                                                    <input type="number" defaultValue="2.0" step="0.1" className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Critical</label>
                                                    <input type="number" defaultValue="3.5" step="0.1" className="w-full px-3 py-1.5 border border-red-300 rounded text-sm font-bold text-red-700 outline-none focus:ring-1 focus:ring-red-500" />
                                                </div>
                                            </div>
                                        </div>

                                        <button className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2 rounded transition-colors mt-2">
                                            Save Thresholds
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
