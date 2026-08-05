import { MachineStatus } from "../../types/machine";

interface StatusBadgeProps {
    status?: MachineStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    switch (status) {
        case 'Running':
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Running
                </span>
            );
        case 'Maintenance':
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></span>
                    Maintenance
                </span>
            );
        case 'Error':
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                    Error
                </span>
            );
        case 'Offline':
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></span>
                    Offline
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {status || 'Unknown'}
                </span>
            );
    }
}
