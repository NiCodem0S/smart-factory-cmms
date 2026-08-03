import { useState } from "react";
import { useMachines } from "../../hooks/useMachines";
import { MachineStatus } from "../../types/machine";
import AddMachineModal from "./AddMachineModal";
import { Search, AlertCircle, Loader2, Eye, Plus, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function MachineFleet() {

    const [page, setPage] = useState<number>(1)
    const [search, setSearch] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<MachineStatus | undefined>(undefined)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const { data, isLoading, error, refetch } = useMachines(page, 10, search, statusFilter);

    const handleSuccess = () => {
        refetch();
        setSuccessMessage("Machine added successfully!");
        setTimeout(() => {
            setSuccessMessage(null);
        }, 4000);
    };

    const renderStatusBadge = (status: MachineStatus) => {
        switch (status) {
            case 'Running':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                        Running
                    </span>
                );
            case 'Error':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                        Error
                    </span>
                );
            case 'Maintenance':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
                        Maintenance
                    </span>
                );
            case 'Offline':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></span>
                        Offline
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Machine Fleet</h1>
                    <p className="text-sm text-slate-500">Manage units, status, and work order allocations</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Add New Machine</span>
                </button>
            </div>

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

            {/* Controls Bar: Search & Status Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    {/* Search Field */}
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Search by name or serial number..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm text-slate-800 placeholder-slate-400"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter || ''}
                        onChange={(e) => {
                            setStatusFilter(e.target.value ? (e.target.value as MachineStatus) : undefined);
                            setPage(1);
                        }}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm text-slate-700"
                    >
                        <option value="">All Statuses</option>
                        <option value="Running">Running</option>
                        <option value="Error">Error</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Offline">Offline</option>
                    </select>
                </div>

                {data && (
                    <div className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-700">{data.data.length}</span> of <span className="font-bold text-slate-700">{data.totalCount}</span> units
                    </div>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <Loader2 className="w-7 h-7 animate-spin mr-3 text-blue-600" />
                    <span className="text-sm font-medium">Loading machine data...</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Table Section */}
            {!isLoading && !error && data && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-bold">
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Machine Name & ID</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4 text-center">Active Work Orders</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {data.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No machines found matching the specified criteria.
                                    </td>
                                </tr>
                            ) : (
                                data.data.map((machine) => (
                                    <tr key={machine.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            {renderStatusBadge(machine.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/machines/${machine.id}`}
                                                className="font-bold text-slate-800 hover:text-blue-600 transition-colors"
                                            >
                                                {machine.name}
                                            </Link>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                SN: {machine.serialNumber}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {machine.category}
                                        </td>
                                        <td className="px-6 py-4 text-center font-semibold text-slate-700">
                                            {machine.activeWorkOrdersCount > 0 ? (
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                                                    {machine.activeWorkOrdersCount}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-normal">0</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/machines/${machine.id}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-sm"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            Page <span className="font-bold text-slate-700">{data.pageNumber}</span> of <span className="font-bold text-slate-700">{data.totalPages}</span> (Total: {data.totalCount} entries)
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={data.pageNumber <= 1}
                                onClick={() => setPage((prev) => prev - 1)}
                                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Previous
                            </button>
                            <button
                                disabled={data.pageNumber >= data.totalPages}
                                onClick={() => setPage((prev) => prev + 1)}
                                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <AddMachineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
            />
        </div>
    );
}