import { ReactNode, useContext } from "react";
import { Menu, Building2 } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";
import Select from "../common/Select";
import { useAuth } from "../../context/AuthContext";
import { NavigationContext } from "../../context/NavigationContext";

interface HeaderProps {
    leftContent?: ReactNode;
    rightContent?: ReactNode;
    children?: ReactNode;
    showHallSelector?: boolean;
}

export default function Header({ leftContent, rightContent, children, showHallSelector = true }: HeaderProps) {
    const { selectedHallId, setSelectedHallId, halls, isLoadingHalls } = useFactory();
    const { user } = useAuth();
    const navigation = useContext(NavigationContext);
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


    return (
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between gap-2 px-4 md:px-8 shrink-0 z-100">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {navigation && (
                    <button
                        type="button"
                        onClick={navigation.toggle}
                        className="md:hidden shrink-0 text-slate-500 hover:text-slate-700 p-1.5 rounded-lg border border-slate-200"
                        aria-label="Toggle navigation"
                        aria-controls="app-sidebar"
                        aria-expanded={navigation.isOpen}
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                {leftContent || children}
            </div>

            {/* Right side of the header */}
            <div className="flex items-center gap-3">
                {/* Factory hall selector */}
                {showHallSelector && (
                    <Select
                        value={selectedHallId}
                        onChange={(val) => setSelectedHallId(val)}
                        options={hallOptions}
                        icon={<Building2 className="w-4 h-4 text-slate-500" />}
                        disabled={isLoadingHalls || !isSuperAdmin}
                        headerTitle="Select Factory Hall"
                        buttonClassName="max-sm:max-w-[47vw] max-sm:px-2"
                    />)}

                {/* Optional content supplied by the current view */}
                {rightContent}
            </div>
        </header>
    );
}
