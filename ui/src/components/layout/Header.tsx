import { ReactNode } from "react";
import { Menu, Building2 } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";

interface HeaderProps {
    onMenuClick?: () => void;
    leftContent?: ReactNode;
    rightContent?: ReactNode;
    children?: ReactNode;
}

export default function Header({ onMenuClick, leftContent, rightContent, children }: HeaderProps) {
    const { selectedHallId, setSelectedHallId, halls, isLoadingHalls } = useFactory();
    return (
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
            <div className="flex items-center gap-3">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-lg border border-slate-200 focus:outline-none"
                        aria-label="Toggle Navigation"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                {leftContent || children}
            </div>

            {/* Prawa strona nagłówka - zawsze renderowana */}
            <div className="flex items-center gap-3">
                {/* Przełącznik Hal */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <select
                        value={selectedHallId || ""}
                        onChange={(e) => setSelectedHallId(e.target.value ? e.target.value : null)}
                        disabled={isLoadingHalls}
                        className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    >
                        <option value="">All Factory Halls (Global)</option>
                        {halls.map((hall) => (
                            <option key={hall.id} value={hall.id}>
                                {hall.name}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Opcjonalna zawartość przekazana z widoku (np. przycisk Add Machine) */}
                {rightContent}
            </div>
        </header>
    );
}

