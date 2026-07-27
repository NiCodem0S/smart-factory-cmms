import { X, LayoutDashboard, Cpu, AlertTriangle, Wrench, BarChart3, Zap, Settings } from 'lucide-react'

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                md:relative md:translate-x-0 shrink-0
            `}>
                {/* Logo & Brand Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5 ">
                        <img src="/logo.png" alt="Smart Factory Logo" className="w-[32px] h-[32px] object-contain" />
                        <span className="text-[19px] font-bold text-white tracking-wider">
                            Smart<span className="text-blue-500">Factory</span>
                        </span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation Groups */}
                <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
                    {/* SECTION 1: OPERATIONS */}
                    <div className="px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        OPERATIONS
                    </div>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <LayoutDashboard className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Live Dashboard</span>
                    </a>
                    <a href="#" className="flex items-center px-6 py-2.5 bg-blue-600/10 text-blue-400 border-r-4 border-blue-500 text-sm font-semibold">
                        <Cpu className="w-4 h-4 mr-3 shrink-0 text-blue-400" />
                        <span>Machine Fleet</span>
                    </a>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <AlertTriangle className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Incident History</span>
                    </a>

                    {/* SECTION 2: PLANNING */}
                    <div className="px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2">
                        PLANNING
                    </div>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <Wrench className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Maintenance</span>
                    </a>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <BarChart3 className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Analytics & Reports</span>
                    </a>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <Zap className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Energy Hub</span>
                    </a>

                    {/* SECTION 3: SYSTEM */}
                    <div className="px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2">
                        SYSTEM
                    </div>
                    <a href="#" className="flex items-center px-6 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
                        <Settings className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Settings</span>
                    </a>
                </nav>

                {/* User Profile Footer */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 text-sm shrink-0">
                    <div className="text-slate-500 text-xs mb-1">Logged in as:</div>
                    <div className="font-bold text-white flex items-center">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-center leading-6 text-xs mr-2 text-white font-bold">
                            JD
                        </div>
                        <span className="text-xs">John Doe (Admin)</span>
                    </div>
                </div>
            </aside>
        </>
    )
}