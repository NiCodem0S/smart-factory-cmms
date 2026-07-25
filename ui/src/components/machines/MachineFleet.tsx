import { useState } from "react";
import { useMachines } from "../../hooks/useMachines";
import { MachineStatus } from "../../types/machine";
import { Search, Filter, AlertCircle, Loader2 } from "lucide-react";

export default function MachineFleet() {
    const [page, setPage] = useState<number>(1)
    const [search, setSearch] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<MachineStatus | undefined>(undefined)

    const { data, isLoading, error } = useMachines(page, 10, search, statusFilter);

    const getStatusBadgeClass = (status: MachineStatus) => {
        switch (status) {
            case 'Running': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Stopped': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'Maintenance': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'Offline': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Flota Maszyn
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Zarządzaj parkiem maszynowym i monitoruj stan urządzeń
                    </p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Szukaj po nazwie lub numerze seryjnym..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 
                        dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 
                        focus:ring-blue-500"
                    />
                </div>
                <select
                    value={statusFilter || ''}
                    onChange={(e) => {
                        setStatusFilter(e.target.value ? (e.target.value as MachineStatus) : undefined)
                        setPage(1)
                    }
                    }
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 
                    dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Wszystkie statusy</option>
                    <option value="Running">Running (Pracuje)</option>
                    <option value="Stopped">Stopped (Zatrzymana)</option>
                    <option value="Maintenance">Maintenance (Konserwacja)</option>
                    <option value="Offline">Offline (Wyłączona)</option>
                </select>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center py-12 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mr-2" />
                    <span>Pobieranie danych maszyn...</span>
                </div>
            )}

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {!isLoading && !error && data && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="p-4 font-medium">Nazwa Maszyny</th>
                                <th className="p-4 font-medium">Kategoria</th>
                                <th className="p-4 font-medium">Nr Seryjny</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-center">Aktywne Zlecenia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {data.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        Nie znaleziono maszyn spełniających kryteria.
                                    </td>
                                </tr>
                            ) : (
                                data.data.map((machine) => (
                                    <tr key={machine.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                                            {machine.name}
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-slate-400">
                                            {machine.category}
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono text-xs">
                                            {machine.serialNumber}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(machine.status)}`}>
                                                {machine.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-medium">
                                            {machine.activeWorkOrdersCount}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            Strona {data.pageNumber} z {data.totalPages} (Razem: {data.totalCount})
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={data.pageNumber <= 1}
                                onClick={() => setPage((prev) => prev - 1)}
                                className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 disabled:opacity-50 
                                rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Poprzednia
                            </button>
                            <button
                                disabled={data.pageNumber >= data.totalPages}
                                onClick={() => setPage((prev) => prev + 1)}
                                className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 disabled:opacity-50 
                                rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Następna
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}