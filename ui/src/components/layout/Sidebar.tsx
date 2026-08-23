import { X, LayoutDashboard, Factory, Cpu, AlertTriangle, Wrench, BarChart3, Zap, Settings, LogOut } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const { user, logout } = useAuth();

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const formatRoleLabel = (role?: string) => {
        switch (role) {
            case 'SuperAdmin': return 'Super Admin';
            case 'HallAdmin': return 'Hall Admin';
            case 'Technician': return 'Technician';
            default: return role || 'User';
        }
    };

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
                    <Link to="/machines" className="flex items-center gap-2.5 ">
                        <img src="/logo.png" alt="Smart Factory Logo" className="w-[33px] h-[33px] object-contain" />
                        <span className="text-[19px] font-bold text-white tracking-wider">
                            Smart<span className="text-blue-500">Factory</span>
                        </span>
                    </Link>
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
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) =>
                            `flex items-center px-6 py-2.5 text-sm font-semibold transition-colors ${
                                isActive
                                    ? 'bg-blue-600/10 text-blue-400 border-r-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <LayoutDashboard className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Live Dashboard</span>
                    </NavLink>
                    <NavLink
                        to="/production"
                        className={({ isActive }) =>
                            `flex items-center px-6 py-2.5 text-sm font-semibold transition-colors ${
                                isActive
                                    ? 'bg-blue-600/10 text-blue-400 border-r-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <Factory className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
                        <span>Production Lines</span>
                    </NavLink>
                    <NavLink
                        to="/machines"
                        className={({ isActive }) =>
                            `flex items-center px-6 py-2.5 text-sm font-semibold transition-colors ${
                                isActive
                                    ? 'bg-blue-600/10 text-blue-400 border-r-4 border-blue-500'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <Cpu className="w-4 h-4 mr-3 shrink-0" />
                        <span>Machine Fleet</span>
                    </NavLink>
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

                {/* User Profile Footer & Logout */}
                <div className="p-3.5 bg-slate-950 border-t border-slate-800 text-sm shrink-0 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs text-blue-400 font-bold shrink-0">
                            {getInitials(user?.fullName || '')}
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold text-white text-xs truncate">
                                {user?.fullName || 'Guest User'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                                ({formatRoleLabel(user?.role)})
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        title="Sign Out"
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors shrink-0"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>
        </>
    )
}