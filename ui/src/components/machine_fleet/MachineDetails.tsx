import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function MachineDetails() {
    const { id } = useParams<{ id: string }>();

    return (
        <div className="space-y-6">
            {/* Top Bar / Navigation */}
            <div className="flex items-center gap-4">
                <Link
                    to="/machines"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Fleet
                </Link>
                <h1 className="text-xl font-bold text-slate-800">
                    Machine Details (ID: {id})
                </h1>
            </div>

            {/* Placeholder / Scratchpad for your implementation */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-600">
                    Strona szczegółów maszyny o ID: <span className="font-mono font-bold text-blue-600">{id}</span>.
                </p>
            </div>
        </div>
    );
}
