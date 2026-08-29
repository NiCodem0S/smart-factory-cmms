import { ReactNode } from "react";
import { Menu, Building2 } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";
import Select from "../common/Select";
import { useAuth } from "../../context/AuthContext";

interface HeaderProps {
    onMenuClick?: () => void;
    leftContent?: ReactNode;
    rightContent?: ReactNode;
    children?: ReactNode;
    showHallSelector?: boolean;
}

export default function Header({ onMenuClick, leftContent, rightContent, children, showHallSelector = true }: HeaderProps) {
    const { selectedHallId, setSelectedHallId, halls, isLoadingHalls } = useFactory();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === "SuperAdmin";


    const hallOptions = isSuperAdmin
        ? [
            { value: null, label: "All Factory Halls (Global)" },
            ...halls.map((hall) => ({
                value: hall.id,
                label: hall.name,
            })),
        ]
        : halls.map((hall) => ({
            value: hall.id,
            label: hall.name,
        }))

    console.log("🔍 HEADER DEBUG:", { role: user?.role, isSuperAdmin, hallOptions: hallOptions.length, disabled: isLoadingHalls || !isSuperAdmin });

    return (
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-100">
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
                {showHallSelector && (
                    <Select
                        value={selectedHallId}
                        onChange={(val) => setSelectedHallId(val)}
                        options={hallOptions}
                        icon={<Building2 className="w-4 h-4 text-slate-500" />}
                        disabled={isLoadingHalls || !isSuperAdmin}
                        headerTitle="Select Factory Hall"
                    />)}

                {/* Opcjonalna zawartość przekazana z widoku (np. przycisk Add Machine) */}
                {rightContent}
            </div>
        </header>
    );
}

