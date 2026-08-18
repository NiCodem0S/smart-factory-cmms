import { useState } from "react"
import Header from "../layout/Header";
import useProductionLinesByHallsId from "../../hooks/useProductionLines";
import { useFactory } from "../../context/FactoryContext";
import { AlertCircle, CheckCircle, Loader2, Plus } from "lucide-react";
import ProductionLineCard from "./ProductionLineCard";

export default function ProductionLines() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const { selectedHallId } = useFactory();
    const { lines, isLoading, error, refetch } = useProductionLinesByHallsId(selectedHallId)

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header
                leftContent={
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Production Lines</h1>
                        <p className="text-xs text-slate-500">Monitor factory throughput and inter-machine dependencies</p>
                    </div>
                }
                rightContent={
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Line</span>
                    </button>
                }
            />
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50">
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
                {/* Loading State */}
                {isLoading && (
                    <div className="flex justify-center items-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <Loader2 className="w-7 h-7 animate-spin mr-3 text-blue-600" />
                        <span className="text-sm font-medium">Loading production data...</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/*Production lines component section*/}
                {!isLoading && !error && lines && (
                    lines.map((line) => (
                        <ProductionLineCard key={line.id} line={line} />
                    ))
                )}
            </div>
        </div>
    )

}