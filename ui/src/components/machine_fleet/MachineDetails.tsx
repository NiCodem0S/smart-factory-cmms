import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react";
import useMachineDetails from "../../hooks/useMachineDetails";
import Header from "../layout/Header";
import { MachineStatus } from "../../types/machine";

export default function MachineDetails() {
    const { id } = useParams<{ id: string }>();
    const { machine, isLoading, error } = useMachineDetails(id);

    const getStatusBadge = (status?: MachineStatus) => {
        switch (status) {
            case 'Running':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                        Running
                    </span>
                );
            case 'Maintenance':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></span>
                        Maintenance
                    </span>
                );
            case 'Error':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                        Error
                    </span>
                );
            case 'Offline':
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></span>
                        Offline
                    </span>
                );
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top Bar / Header */}
            <Header
                leftContent={
                    <div className="flex items-center gap-4">
                        <Link
                            to="/machines"
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Back to Machine Fleet"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <div className="text-xs text-slate-400 font-medium mb-0.5">
                                Machine Fleet / Details
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-800">
                                    {machine ? machine.name : "Loading..."}
                                </h1>
                                {machine && getStatusBadge(machine.status)}
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
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-2">
                                Machine Overview: {machine.name}
                            </h2>
                            <p className="text-sm text-slate-600">
                                Category: <span className="font-semibold">{machine.category}</span> | Serial: <span className="font-semibold">{machine.serialNumber}</span>
                            </p>
                            <p className="text-sm text-slate-600 mt-2">
                                Total Operating Hours: <span className="font-bold text-blue-600">{machine.totalOperatingHours} hrs</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
